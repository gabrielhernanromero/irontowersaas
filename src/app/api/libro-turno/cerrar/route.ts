import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { CerrarTurnoSchema } from '@/lib/validations/libroTurno'
import { alertarSupervisores } from '@/lib/alertas/createAlerta'
import { getArgTime } from '@/lib/cobertura/timeUtils'

async function uploadFirma(dataUrl: string, userId: string): Promise<string> {
  const base64 = dataUrl.split(',')[1]
  if (!base64) throw new Error('dataUrl inválido')
  const buffer = Buffer.from(base64, 'base64')
  const path = `${userId}/cierre-${Date.now()}.png`
  const { error } = await supabaseAdmin()
    .storage.from('firmas')
    .upload(path, buffer, { contentType: 'image/png' })
  if (error) throw new Error('Error al subir firma')
  return path
}

// Minutos restantes hasta hora_fin. Positivo = queda tiempo. Soporta cross-midnight.
function minutosHastaFin(horaFin: string, hours: number, minutes: number): number {
  const [finH, finM] = horaFin.split(':').map(Number)
  const finMin = finH * 60 + finM
  const nowMin = hours * 60 + minutes
  let diff = finMin - nowMin
  if (diff < -120) diff += 1440
  return diff
}

export async function POST(req: NextRequest) {
  const { data: { user }, error: authErr } = await supabaseServer().auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = CerrarTurnoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.flatten() }, { status: 422 })
  }

  const { turno_id, horario_fin, firma_cierre_dataurl, motivo_cierre_anticipado } = parsed.data

  const { data: turno } = await supabaseAdmin()
    .from('libro_turno')
    .select('id, estado, tecnico_id, tecnico_nombre, tecnico_dni, cliente_id, esquema_id')
    .eq('id', turno_id)
    .single()

  if (!turno) return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })
  if (turno.tecnico_id !== user.id) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  if (turno.estado !== 'abierto') return NextResponse.json({ error: 'El turno no está abierto' }, { status: 409 })

  // ── 1. Cierre anticipado + relevo configurado por supervisor ─────────────────
  let esAnticipado = false
  let minsRestantes = 0
  let hayRelevo = false

  const { hours, minutes } = getArgTime()

  if (turno.esquema_id) {
    const { data: esquemaActual } = await supabaseAdmin()
      .from('esquemas_cobertura')
      .select('hora_fin, requiere_relevo')
      .eq('id', turno.esquema_id)
      .single()

    if (esquemaActual?.hora_fin) {
      minsRestantes = minutosHastaFin(esquemaActual.hora_fin.slice(0, 5), hours, minutes)
      esAnticipado = minsRestantes > 30
    }

    hayRelevo = esquemaActual?.requiere_relevo ?? false
  }

  // Cierre anticipado requiere motivo
  if (esAnticipado && !motivo_cierre_anticipado?.trim()) {
    return NextResponse.json(
      { error: 'El cierre es anticipado. Indicá el motivo antes de cerrar.' },
      { status: 422 },
    )
  }

  // ── 2. Verificar planillas enviadas ───────────────────────────────────────────
  let planillasRequeridas: string[] = ['hidrantes', 'extintores']
  if (turno.cliente_id) {
    const { data: cliente } = await supabaseAdmin()
      .from('clientes')
      .select('planillas_habilitadas')
      .eq('id', turno.cliente_id)
      .single()
    if (cliente?.planillas_habilitadas?.length) {
      planillasRequeridas = cliente.planillas_habilitadas
    }
  }

  const { data: planillasEnviadas } = await supabaseAdmin()
    .from('planillas')
    .select('tipo')
    .eq('turno_id', turno_id)
    .eq('inmutable', true)

  const tiposEnviados = (planillasEnviadas ?? []).map((p) => p.tipo)
  const faltantes: string[] = []
  if (planillasRequeridas.includes('hidrantes') && !tiposEnviados.includes('hidrantes')) faltantes.push('Hidrantes')
  if (planillasRequeridas.includes('extintores') && !tiposEnviados.includes('extintores')) faltantes.push('Extintores')

  if (faltantes.length > 0) {
    return NextResponse.json(
      { error: `Debés enviar las planillas antes de cerrar el turno: ${faltantes.join(', ')}` },
      { status: 422 },
    )
  }

  // ── 3. Subir firma ────────────────────────────────────────────────────────────
  let firmaCierreUrl: string
  try {
    firmaCierreUrl = await uploadFirma(firma_cierre_dataurl, user.id)
  } catch {
    return NextResponse.json({ error: 'Error al subir la firma' }, { status: 500 })
  }

  // ── 4. Novedad de cierre ──────────────────────────────────────────────────────
  let descripcionCierre = `Cierre de guardia — ${turno.tecnico_nombre}, DNI ${turno.tecnico_dni}`
  if (esAnticipado) {
    descripcionCierre = `Cierre anticipado de guardia — ${turno.tecnico_nombre}, DNI ${turno.tecnico_dni}. Motivo: ${motivo_cierre_anticipado}`
  } else if (!hayRelevo) {
    descripcionCierre = `Cierre de guardia sin cobertura programada — ${turno.tecnico_nombre}, DNI ${turno.tecnico_dni}`
  }

  await supabaseAdmin().from('libro_novedad').insert({
    turno_id,
    tecnico_id: user.id,
    tipo: 'cierre',
    hora: horario_fin,
    descripcion: descripcionCierre,
  })

  // ── 5. Cerrar turno ───────────────────────────────────────────────────────────
  const estadoCierre = hayRelevo ? 'pendiente_relevo' : 'cerrado'

  const updatePayload: Record<string, unknown> = {
    estado: estadoCierre,
    horario_fin,
    firma_cierre_url: firmaCierreUrl,
  }
  if (esAnticipado && motivo_cierre_anticipado) {
    updatePayload.motivo_cierre_anticipado = motivo_cierre_anticipado
  }

  const { data: turnoCerrado, error: updateErr } = await supabaseAdmin()
    .from('libro_turno')
    .update(updatePayload)
    .eq('id', turno_id)
    .select()
    .single()

  if (updateErr) return NextResponse.json({ error: 'Error al cerrar el turno' }, { status: 500 })

  // ── 6. Alerta a supervisores si cierre anticipado (> 30 min) ─────────────────
  if (esAnticipado) {
    const h = Math.floor(minsRestantes / 60)
    const m = minsRestantes % 60
    const tiempoStr = h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${m}min`
    const mensajeAlerta =
      `${turno.tecnico_nombre} cerró su guardia ${tiempoStr} antes del horario programado. ` +
      `Motivo: ${motivo_cierre_anticipado}`

    alertarSupervisores('cierre_anticipado', mensajeAlerta, { turnoId: turno_id }).catch(() => {})

    // ── 7. Incidencia automática si cierre muy anticipado (≥ 90 min) ─────────
    if (minsRestantes >= 90 && turno.cliente_id) {
      supabaseAdmin().from('incidencias').insert({
        cliente_id:          turno.cliente_id,
        turno_creacion_id:   turno_id,
        titulo:              'Cierre anticipado de guardia',
        descripcion:         `${turno.tecnico_nombre} cerró la guardia ${tiempoStr} antes del horario programado. Motivo: ${motivo_cierre_anticipado}`,
        severidad:           'alto',
        estado:              'abierto',
        tecnico_detector_id: user.id,
      }).then(() => {})
    }
  }

  return NextResponse.json(turnoCerrado, { status: 200 })
}
