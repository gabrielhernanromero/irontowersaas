import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { data: { user }, error: authErr } = await supabaseServer().auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: novedad } = await supabaseAdmin()
    .from('libro_novedad')
    .select('id, tipo, turno_id, acusado_en, tecnico_id')
    .eq('id', params.id)
    .single()

  if (!novedad) return NextResponse.json({ error: 'Novedad no encontrada' }, { status: 404 })
  if (novedad.tipo !== 'alerta') return NextResponse.json({ error: 'Solo se puede acusar alertas' }, { status: 400 })
  if (novedad.acusado_en) return NextResponse.json({ error: 'Ya fue acusada' }, { status: 409 })

  // Solo el encargado del turno puede acusar
  const { data: turno } = await supabaseAdmin()
    .from('libro_turno')
    .select('id, tecnico_id, estado')
    .eq('id', novedad.turno_id)
    .single()

  if (!turno) return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })
  if (turno.tecnico_id !== user.id) return NextResponse.json({ error: 'Solo el encargado puede acusar alertas' }, { status: 403 })
  if (turno.estado !== 'abierto') return NextResponse.json({ error: 'El turno está cerrado' }, { status: 409 })

  const { data, error } = await supabaseAdmin()
    .from('libro_novedad')
    .update({ acusado_en: new Date().toISOString(), acusado_por: user.id })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Error al registrar el acuse' }, { status: 500 })
  return NextResponse.json(data)
}
