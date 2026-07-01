import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { data: { user }, error: authErr } = await supabaseServer().auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const userMeta = user.user_metadata as { rol?: string }
  if (!['admin', 'supervisor'].includes(userMeta?.rol ?? '')) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { id } = params

  // Verificar que la asignación existe y que el turno no fue abierto aún
  const { data: asignacion } = await supabaseAdmin()
    .from('asignaciones_turno')
    .select('id, cliente_id, fecha, turno, rol_turno')
    .eq('id', id)
    .maybeSingle()

  if (!asignacion) return NextResponse.json({ error: 'Asignación no encontrada' }, { status: 404 })

  const { error } = await supabaseAdmin()
    .from('asignaciones_turno')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: 'Error al eliminar asignación' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
