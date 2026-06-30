import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  let me: Awaited<ReturnType<typeof requireRole>>
  try { me = await requireRole('tecnico', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { turnoBlockeanteId } = await req.json().catch(() => ({}))
  if (!turnoBlockeanteId) {
    return NextResponse.json({ error: 'turnoBlockeanteId requerido' }, { status: 400 })
  }

  // Verificar que el turno existe y sigue abierto
  const { data: turno } = await supabaseAdmin()
    .from('libro_turno')
    .select('id, estado, tecnico_nombre, folio_numero, cliente_id, aviso_supervisor_at, tecnico_id')
    .eq('id', turnoBlockeanteId)
    .single()

  if (!turno) return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })
  if (turno.estado !== 'abierto') {
    return NextResponse.json({ error: 'El turno ya no está abierto' }, { status: 409 })
  }

  // Dedup: si ya se avisó, devolver ok sin insertar de nuevo
  if (turno.aviso_supervisor_at) {
    return NextResponse.json({ ok: true, yaAvisado: true })
  }

  // Obtener perfil del técnico que avisa
  const { data: perfilMe } = await supabaseAdmin()
    .from('users')
    .select('nombre, apellido')
    .eq('id', me.id)
    .single()
  const entranteNombre = perfilMe
    ? `${perfilMe.nombre} ${perfilMe.apellido}`.trim()
    : 'El encargado entrante'

  // Obtener supervisores/admins
  const { data: supervisores } = await supabaseAdmin()
    .from('users')
    .select('id')
    .in('rol', ['supervisor', 'admin'])
    .eq('activo', true)

  const mensaje = `⚠ Turno sin cerrar: ${turno.tecnico_nombre} (folio #${turno.folio_numero}) no cerró su guardia. ${entranteNombre} no puede iniciar el turno siguiente. Revisá y cerrá el turno para desbloquearlo.`

  const alertas = (supervisores ?? []).map((s: { id: string }) => ({
    tipo:            'turno_sin_cerrar' as const,
    mensaje,
    destinatario_id: s.id,
    turno_id:        turnoBlockeanteId,
    leida:           false,
  }))

  if (alertas.length > 0) {
    await supabaseAdmin().from('alertas').insert(alertas)
  }

  // Marcar aviso en el turno para dedup futuro
  await supabaseAdmin()
    .from('libro_turno')
    .update({ aviso_supervisor_at: new Date().toISOString() })
    .eq('id', turnoBlockeanteId)

  return NextResponse.json({ ok: true, yaAvisado: false, avisados: alertas.length })
}
