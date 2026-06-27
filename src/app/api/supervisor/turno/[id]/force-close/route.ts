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
    .select('id, estado, tecnico_nombre')
    .eq('id', params.id)
    .single()

  if (!turno) return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })
  if (turno.estado !== 'pendiente_relevo') {
    return NextResponse.json({ error: 'El turno no está pendiente de relevo' }, { status: 409 })
  }

  const { hours, minutes } = getArgTime()
  const horaActual = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`

  const { error: updateErr } = await supabaseAdmin()
    .from('libro_turno')
    .update({ estado: 'cerrado', horario_fin: horaActual })
    .eq('id', params.id)

  if (updateErr) return NextResponse.json({ error: 'Error al cerrar el turno' }, { status: 500 })

  // Novedad de auditoría
  const { data: supervisor } = await supabaseAdmin()
    .from('users')
    .select('nombre, apellido')
    .eq('id', supervisorUser.id)
    .single()
  const supervisorNombre = supervisor ? `${supervisor.nombre} ${supervisor.apellido}` : 'Supervisor'

  await supabaseAdmin().from('libro_novedad').insert({
    turno_id:    params.id,
    tecnico_id:  supervisorUser.id,
    tipo:        'cierre',
    hora:        horaActual,
    descripcion: `Cierre forzado por supervisión — ${supervisorNombre}. Motivo: ${motivo.trim()}`,
  })

  return NextResponse.json({ ok: true })
}
