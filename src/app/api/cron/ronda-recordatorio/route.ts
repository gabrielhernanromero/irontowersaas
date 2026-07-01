import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const ahora = new Date()

  // ── 1. Turnos activos con configuración de rondas ─────────────────────────
  const { data: turnos } = await supabaseAdmin()
    .from('libro_turno')
    .select(`
      id, tecnico_id, cliente_id, created_at,
      clientes!inner(id, frecuencia_ronda_minutos, aviso_ronda_minutos, nombre_empresa)
    `)
    .in('estado', ['abierto', 'pendiente_relevo'])

  const turnosConConfig = (turnos ?? []).filter(
    (t: any) => t.clientes?.frecuencia_ronda_minutos != null
  )

  if (!turnosConConfig.length) {
    return NextResponse.json({ ok: true, avisados: 0, vencidos: 0, mensaje: 'Sin turnos con frecuencia configurada' })
  }

  const turnoIds = turnosConConfig.map((t: any) => t.id as string)

  // ── 2. Supervisores/admins (destinatarios de alertas vencidas) ────────────
  const { data: supervisores } = await supabaseAdmin()
    .from('users')
    .select('id')
    .in('rol', ['supervisor', 'admin'])
  const supervisorIds = (supervisores ?? []).map((s: any) => s.id as string)

  // ── 3. Batch: todas las rondas de estos turnos ────────────────────────────
  const { data: todasRondas } = await supabaseAdmin()
    .from('rondas')
    .select('id, turno_id, hora_inicio, hora_fin, completa')
    .in('turno_id', turnoIds)

  // ── 4. Batch: alertas de ronda ya enviadas (deduplicación) ────────────────
  const { data: todasAlertas } = await supabaseAdmin()
    .from('alertas')
    .select('id, turno_id, tipo, destinatario_id, created_at')
    .in('turno_id', turnoIds)
    .in('tipo', ['ronda_vencida', 'ronda_proxima'])

  // ── Agrupar en memoria ────────────────────────────────────────────────────
  const rondasPorTurno: Record<string, { hora_inicio: string; hora_fin: string | null; completa: boolean }[]> = {}
  for (const r of todasRondas ?? []) {
    if (!rondasPorTurno[r.turno_id]) rondasPorTurno[r.turno_id] = []
    rondasPorTurno[r.turno_id].push(r)
  }

  // Para deduplicar vencidas: contamos alertas al TÉCNICO (1 por slot vencido)
  // Usar solo alertas del técnico evita contar las copias de supervisores
  const vencidasPorTurnoTecnico: Record<string, number> = {}
  // Para deduplicar próximas: guardamos created_at por turno
  const proximasPorTurno: Record<string, string[]> = {}

  for (const a of todasAlertas ?? []) {
    if (!a.turno_id) continue
    const turno = turnosConConfig.find((t: any) => t.id === a.turno_id)
    if (!turno) continue

    if (a.tipo === 'ronda_vencida' && a.destinatario_id === (turno as any).tecnico_id) {
      vencidasPorTurnoTecnico[a.turno_id] = (vencidasPorTurnoTecnico[a.turno_id] ?? 0) + 1
    }
    if (a.tipo === 'ronda_proxima') {
      if (!proximasPorTurno[a.turno_id]) proximasPorTurno[a.turno_id] = []
      proximasPorTurno[a.turno_id].push(a.created_at)
    }
  }

  // ── Procesar cada turno ───────────────────────────────────────────────────
  let avisados = 0
  let vencidos  = 0

  const alertasInsert:   object[] = []
  const novedadesInsert: object[] = []
  // Para vincular novedad_id a alertas vencidas (por turno_id)
  const turnosConNovedad = new Set<string>()

  for (const turno of turnosConConfig) {
    const cliente      = (turno as any).clientes
    const frecuenciaMin = cliente.frecuencia_ronda_minutos as number
    const avisoMin      = (cliente.aviso_ronda_minutos as number) ?? 10

    // ── Slots fijos: calculados desde el inicio del turno ─────────────────
    // Slot N vence en: turnoInicio + N × frecuencia
    // No depende del horario de la ronda anterior → sin drift.
    const turnoInicio          = new Date(turno.created_at)
    const minutosDesdeInicio   = (ahora.getTime() - turnoInicio.getTime()) / 60000
    if (minutosDesdeInicio < 1) continue

    const rondas = rondasPorTurno[turno.id] ?? []

    // Si hay ronda en curso → esperar a que termine
    const enCurso = rondas.find(r => !r.hora_fin && !r.completa)
    if (enCurso) continue

    // Rondas completadas en este turno (completa=true o con hora_fin)
    const rondasCompletadas = rondas.filter(r => r.completa || r.hora_fin).length

    // Cuántos slots debieron haberse completado hasta ahora (ej: 3h / 60min = 3 slots)
    const slotsDebidos = Math.floor(minutosDesdeInicio / frecuenciaMin)

    // Cuántas alertas vencidas ya se emitieron (1 por slot alertado al técnico)
    const slotsYaAlertados = vencidasPorTurnoTecnico[turno.id] ?? 0

    // Slots vencidos sin cubrir (ni con ronda completada ni con alerta enviada)
    const slotsSinCubrirSinAlertar = slotsDebidos - rondasCompletadas - slotsYaAlertados

    // ── RONDA VENCIDA ───────────────────────────────────────────────────────
    if (slotsSinCubrirSinAlertar > 0) {
      // Número del slot que acaba de vencer (el más antiguo sin alerta ni ronda)
      const slotVencido  = rondasCompletadas + slotsYaAlertados + 1
      const slotDueTime  = new Date(turnoInicio.getTime() + slotVencido * frecuenciaMin * 60000)
      const minutosRetraso = Math.round((ahora.getTime() - slotDueTime.getTime()) / 60000)

      const horaSlot     = slotDueTime.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
      const msgTecnico   = `Ronda ${slotVencido} vencida — ${minutosRetraso > 0 ? `${minutosRetraso} min de retraso` : 'ya debería haberse completado'} (${cliente.nombre_empresa})`
      const msgSupervisor = `⚠ Ronda ${slotVencido} sin completar: ${cliente.nombre_empresa} — esperada a las ${horaSlot}, lleva ${Math.round(minutosDesdeInicio - slotVencido * frecuenciaMin)} min de retraso`

      // Alerta al técnico
      alertasInsert.push({
        tipo: 'ronda_vencida', mensaje: msgTecnico,
        destinatario_id: turno.tecnico_id, leida: false, turno_id: turno.id,
      })
      // Alerta a cada supervisor/admin
      for (const supId of supervisorIds) {
        alertasInsert.push({
          tipo: 'ronda_vencida', mensaje: msgSupervisor,
          destinatario_id: supId, leida: false, turno_id: turno.id,
        })
      }

      // Novedad automática en el libro de guardia
      novedadesInsert.push({
        turno_id:    turno.id,
        tecnico_id:  turno.tecnico_id,
        tipo:        'sistema',
        hora:        ahora.toTimeString().slice(0, 5),
        descripcion: `Sistema: ronda ${slotVencido} no completada en tiempo (esperada a las ${horaSlot}). Frecuencia configurada: ${frecuenciaMin} min.`,
      })
      turnosConNovedad.add(turno.id)

      vencidos++
      continue // No procesar aviso próxima en el mismo ciclo
    }

    // ── AVISO ANTICIPADO (ronda_proxima) ───────────────────────────────────
    // Solo si todos los slots pasados están cubiertos

    // Próximo slot a completar
    const proximoSlot  = slotsDebidos + 1

    // Si ya completó más rondas de las esperadas → no avisar
    if (rondasCompletadas >= proximoSlot) continue

    const nextSlotTime         = new Date(turnoInicio.getTime() + proximoSlot * frecuenciaMin * 60000)
    const minutosHastaNextSlot = (nextSlotTime.getTime() - ahora.getTime()) / 60000

    // Fuera de la ventana de aviso
    if (minutosHastaNextSlot > avisoMin || minutosHastaNextSlot <= 0) continue

    // Deduplicar: ¿ya se envió aviso para ESTE slot en particular?
    const avisoWindowStart = new Date(nextSlotTime.getTime() - avisoMin * 60000).toISOString()
    const avisoYaEnviado = (proximasPorTurno[turno.id] ?? []).some(ts => ts >= avisoWindowStart)
    if (avisoYaEnviado) continue

    const minutosRestantes = Math.round(minutosHastaNextSlot)
    alertasInsert.push({
      tipo: 'ronda_proxima',
      mensaje: `Ronda ${proximoSlot} en ${minutosRestantes} min — ${cliente.nombre_empresa}`,
      destinatario_id: turno.tecnico_id,
      leida: false,
      turno_id: turno.id,
    })
    avisados++
  }

  // ── Persistir novedades primero (para vincular novedad_id en alertas) ────
  const novedadIdsPorTurno: Record<string, string> = {}
  if (novedadesInsert.length > 0) {
    const { data: insertadas } = await supabaseAdmin()
      .from('libro_novedad')
      .insert(novedadesInsert)
      .select('id, turno_id')
    for (const nv of insertadas ?? []) {
      novedadIdsPorTurno[nv.turno_id] = nv.id
    }
  }

  // ── Persistir alertas ─────────────────────────────────────────────────────
  if (alertasInsert.length > 0) {
    const alertasConNovedad = alertasInsert.map((a: any) => ({
      ...a,
      novedad_id: a.tipo === 'ronda_vencida' && turnosConNovedad.has(a.turno_id)
        ? (novedadIdsPorTurno[a.turno_id] ?? null)
        : null,
    }))
    await supabaseAdmin().from('alertas').insert(alertasConNovedad)
  }

  return NextResponse.json({ ok: true, avisados, vencidos, timestamp: ahora.toISOString() })
}
