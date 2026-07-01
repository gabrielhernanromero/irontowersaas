import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getArgTime } from '@/lib/cobertura/timeUtils'

const GRACIA_MIN = 15

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { hours, minutes, hoy, ayer } = getArgTime()
  const ahoraMin = hours * 60 + minutes

  // Día de la semana en hora Argentina
  const argDate = new Date(Date.now() - 3 * 60 * 60 * 1000)
  const diaHoy = argDate.getUTCDay() // 0=dom…6=sáb

  // ── 1. Supervisores/admins ────────────────────────────────────────────────
  const { data: supervisores } = await supabaseAdmin()
    .from('users')
    .select('id')
    .in('rol', ['supervisor', 'admin'])
  const supervisorIds = (supervisores ?? []).map((s: any) => s.id as string)

  // ── 2. Esquemas activos y dentro de ventana ───────────────────────────────
  const { data: esquemas } = await supabaseAdmin()
    .from('esquemas_cobertura')
    .select('id, hora_inicio, hora_fin, dias_semana, fecha_desde, fecha_hasta, cliente_id')
    .eq('activo', true)
    .lte('fecha_desde', hoy)

  if (!esquemas?.length) {
    return NextResponse.json({ ok: true, alertados: 0, msg: 'Sin esquemas activos' })
  }

  const esquemasEnVentana = esquemas.filter(e => {
    if (e.fecha_hasta && e.fecha_hasta < hoy) return false
    const dias: number[] = (e.dias_semana as number[]) ?? [0, 1, 2, 3, 4, 5, 6]
    if (!dias.includes(diaHoy)) return false

    const [sH, sM] = (e.hora_inicio as string).split(':').map(Number)
    const inicioMin = sH * 60 + sM
    const [fH, fM] = (e.hora_fin as string).split(':').map(Number)
    const finMin = fH * 60 + fM

    if (ahoraMin - inicioMin < GRACIA_MIN) return false

    // Turno ya terminó?
    const turnoTermino = finMin > inicioMin
      ? ahoraMin >= finMin
      : ahoraMin >= finMin + 1440 // cross-midnight
    return !turnoTermino
  })

  if (!esquemasEnVentana.length) {
    return NextResponse.json({ ok: true, alertados: 0, msg: 'Ningún esquema en ventana de alerta' })
  }

  // ── 3. Dedup: no re-enviar alerta del mismo encargado en el mismo día ─────
  const { data: alertasHoy } = await supabaseAdmin()
    .from('alertas')
    .select('mensaje')
    .eq('tipo', 'ausencia_encargado')
    .gte('created_at', `${hoy}T03:00:00.000Z`) // medianoche ARG = 03:00 UTC

  const mensajesEnviados = new Set((alertasHoy ?? []).map((a: any) => a.mensaje as string))

  // ── 4. Para cada esquema activo, detectar ausencia ───────────────────────
  const alertasInsert: object[] = []
  let alertados = 0

  for (const esquema of esquemasEnVentana) {
    // Encargado efectivo: asignaciones_turno tiene prioridad sobre persistente
    const { data: excepcionEnc } = await supabaseAdmin()
      .from('asignaciones_turno')
      .select('usuario_id, usuario:usuario_id(id, nombre, apellido)')
      .eq('esquema_id', esquema.id)
      .eq('rol_turno', 'encargado')
      .in('fecha', [hoy, ayer])
      .maybeSingle()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let encargadoId: string | null = (excepcionEnc as any)?.usuario_id ?? null
    let encargadoNombre: string | null = null
    if ((excepcionEnc as any)?.usuario) {
      const u = (excepcionEnc as any).usuario as { nombre: string; apellido: string }
      encargadoNombre = `${u.nombre} ${u.apellido}`.trim()
    }

    if (!encargadoId) {
      const { data: persistenteEnc } = await supabaseAdmin()
        .from('asignaciones_persistentes')
        .select('usuario_id, usuario:usuario_id(id, nombre, apellido)')
        .eq('esquema_id', esquema.id)
        .eq('rol_turno', 'encargado')
        .maybeSingle()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      encargadoId = (persistenteEnc as any)?.usuario_id ?? null
      if ((persistenteEnc as any)?.usuario) {
        const u = (persistenteEnc as any).usuario as { nombre: string; apellido: string }
        encargadoNombre = `${u.nombre} ${u.apellido}`.trim()
      }
    }

    if (!encargadoId || !encargadoNombre) continue // Sin encargado asignado

    // ¿El encargado ya abrió turno hoy (cualquier estado)?
    const { data: turnoHoy } = await supabaseAdmin()
      .from('libro_turno')
      .select('id')
      .eq('tecnico_id', encargadoId)
      .eq('fecha', hoy)
      .maybeSingle()

    if (turnoHoy) continue // Presente

    // Encargado ausente: preparar mensajes
    const [sH, sM] = (esquema.hora_inicio as string).split(':').map(Number)
    const horaStr = `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')}`

    const msgApoyo = `El encargado ${encargadoNombre} no se presentó (turno desde ${horaStr}). Podés abrir el turno como encargado interino.`
    const msgSup   = `⚠ Ausencia de encargado: ${encargadoNombre} no abrió su turno (desde ${horaStr}).`

    if (mensajesEnviados.has(msgApoyo)) continue // Ya enviado hoy

    // Apoyo efectivo: asignaciones_turno tiene prioridad
    const { data: excepcionesApoyo } = await supabaseAdmin()
      .from('asignaciones_turno')
      .select('usuario_id')
      .eq('esquema_id', esquema.id)
      .eq('rol_turno', 'apoyo')
      .in('fecha', [hoy, ayer])

    let apoyoIds: string[] = (excepcionesApoyo ?? []).map((a: any) => a.usuario_id as string)

    if (apoyoIds.length === 0) {
      const { data: persistentesApoyo } = await supabaseAdmin()
        .from('asignaciones_persistentes')
        .select('usuario_id')
        .eq('esquema_id', esquema.id)
        .eq('rol_turno', 'apoyo')
      apoyoIds = (persistentesApoyo ?? []).map((a: any) => a.usuario_id as string)
    }

    for (const apoyoId of apoyoIds) {
      alertasInsert.push({
        tipo:            'ausencia_encargado',
        mensaje:         msgApoyo,
        destinatario_id: apoyoId,
        leida:           false,
      })
    }

    for (const supId of supervisorIds) {
      alertasInsert.push({
        tipo:            'ausencia_encargado',
        mensaje:         msgSup,
        destinatario_id: supId,
        leida:           false,
      })
    }

    alertados++
  }

  if (alertasInsert.length > 0) {
    await supabaseAdmin().from('alertas').insert(alertasInsert)
  }

  return NextResponse.json({ ok: true, alertados, timestamp: new Date().toISOString() })
}
