import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function PATCH(req: NextRequest) {
  const { data: { user } } = await supabaseServer().auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { turno_id } = await req.json()

  const query = supabaseAdmin()
    .from('alertas')
    .update({ leida: true })
    .eq('destinatario_id', user.id)
    .eq('tipo', 'novedad_apoyo')
    .eq('leida', false)

  if (turno_id) query.eq('turno_id', turno_id)

  await query

  return NextResponse.json({ ok: true })
}
