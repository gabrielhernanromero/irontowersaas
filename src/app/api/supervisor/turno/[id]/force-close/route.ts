import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getArgTime } from '@/lib/cobertura/timeUtils'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let supervisorUser: Awaited<ReturnType<typeof requireRole>>
  try { supervisorUser = await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { motivo } = await req.json().catch(() => ({}))
  if (!motivo?.trim()) {
    return NextResponse.json({ error: 'Indicá un motivo para el cierre forzado' }, { status: 400 })
  }

  const { data: turno } = await supabaseAdmin()
    .from('libro_turno')
    .select('id, estado, tecnico_nombre, tecnico_id')
    .eq('id', params.id)
    .single()

  if (!turno) return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })

  const esAbierto        = turno.estado === 'abierto'
  const esPendRelevo     = turno.estado === 'pendiente_relevo'

  if (!esAbierto && !esPendRelevo) {
    return NextResponse.json({ error: 'El turno ya está cerrado' }, { status: 409 })
  }

  const { hours, minutes } = getArgTime()
  const horaActual = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`

  // Turno abierto → pendiente_relevo (para que el entrante deba firmar el relevo)
  // Turno pendiente_relevo → cerrado (cierre final forzado sin relevo)
  const nuevoEstado = esAbierto ? 'pendiente_relevo' : 'cerrado'

  const { error: updateErr } = await supabaseAdmin()
    .from('libro_turno')
    .update({ estado: nuevoEstado, horario_fin: horaActual })
    .eq('id', params.id)

  if (updateErr) return NextResponse.json({ error: 'Error al cerrar el turno' }, { status: 500 })

  // Novedad de auditoría en el turno
  const { data: supervisor } = await supabaseAdmin()
    .from('users')
    .select('nombre, apellido')
    .eq('id', supervisorUser.id)
    .single()
  const supervisorNombre = supervisor ? `${supervisor.nombre} ${supervisor.apellido}` : 'Supervisor'

  const descripcionNovedad = esAbierto
    ? `Turno cerrado por supervisión (pendiente de relevo) — ${supervisorNombre}. Motivo: ${motivo.trim()}`
    : `Cierre forzado por supervisión — ${supervisorNombre}. Motivo: ${motivo.trim()}`

  await supabaseAdmin().from('libro_novedad').insert({
    turno_id:    params.id,
    tecnico_id:  supervisorUser.id,
    tipo:        'cierre',
    hora:        horaActual,
    descripcion: descripcionNovedad,
  })

  // Notificar al técnico saliente
  if (turno.tecnico_id) {
    const mensaje = esAbierto
      ? `Tu guardia (folio #${params.id}) fue cerrada por supervisión porque no la cerraste a tiempo. Motivo registrado: "${motivo.trim()}". Contactá a tu supervisor.`
      : `Tu guardia quedó marcada como cerrada por supervisión. Motivo: "${motivo.trim()}".`

    await supabaseAdmin().from('alertas').insert({
      tipo:            'turno_sin_cerrar',
      mensaje,
      destinatario_id: turno.tecnico_id,
      turno_id:        params.id,
      leida:           false,
    })
  }

  return NextResponse.json({ ok: true, nuevoEstado })
}
