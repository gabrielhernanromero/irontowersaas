import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const AprobarSchema = z.object({
  decision: z.enum(['aprobada', 'rechazada']),
  turno_id: z.string().uuid(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { data: { user }, error: authErr } = await supabaseServer().auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = AprobarSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.flatten() }, { status: 422 })
  }

  const { decision, turno_id } = parsed.data
  const incidencia_id = params.id

  // Verificar que el usuario es el encargado del turno
  const { data: turno } = await supabaseAdmin()
    .from('libro_turno')
    .select('id, estado, tecnico_id')
    .eq('id', turno_id)
    .single()

  if (!turno) return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })
  if (turno.tecnico_id !== user.id) {
    return NextResponse.json({ error: 'Solo el encargado del turno puede aprobar incidencias' }, { status: 403 })
  }

  // Obtener la incidencia
  const { data: incidencia } = await supabaseAdmin()
    .from('incidencias')
    .select('id, titulo, estado_aprobacion, requiere_aprobacion, severidad, turno_creacion_id')
    .eq('id', incidencia_id)
    .single()

  if (!incidencia) return NextResponse.json({ error: 'Incidencia no encontrada' }, { status: 404 })
  if (!incidencia.requiere_aprobacion) {
    return NextResponse.json({ error: 'Esta incidencia no requiere aprobación' }, { status: 409 })
  }
  if (incidencia.estado_aprobacion !== 'pendiente_revision') {
    return NextResponse.json({ error: 'La incidencia ya fue procesada' }, { status: 409 })
  }

  // Aplicar decisión
  const { error: updateErr } = await supabaseAdmin()
    .from('incidencias')
    .update({
      estado_aprobacion: decision,
      aprobada_por:      user.id,
      aprobada_at:       new Date().toISOString(),
    })
    .eq('id', incidencia_id)

  if (updateErr) return NextResponse.json({ error: 'Error al procesar la aprobación' }, { status: 500 })

  // Registrar en el libro la decisión del encargado
  const hora = new Date().toTimeString().slice(0, 5)
  const accion = decision === 'aprobada' ? 'APROBADA' : 'RECHAZADA'

  await supabaseAdmin()
    .from('libro_novedad')
    .insert({
      turno_id:    turno_id,
      tecnico_id:  user.id,
      tipo:        'novedad',
      hora,
      descripcion: `Incidencia ${accion} por encargado — "${incidencia.titulo}"`,
    })

  return NextResponse.json({ ok: true, decision })
}
