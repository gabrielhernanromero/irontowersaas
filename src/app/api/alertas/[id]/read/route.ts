import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const {
    data: { user },
    error: authErr,
  } = await supabaseServer().auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // RLS garantiza que solo el destinatario puede actualizar
  const { error } = await supabaseServer()
    .from('alertas')
    .update({ leida: true })
    .eq('id', params.id)
    .eq('destinatario_id', user.id)

  if (error) {
    return NextResponse.json({ error: 'Error al marcar la alerta' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
