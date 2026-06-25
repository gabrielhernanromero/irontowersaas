import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Marca como leídas las alertas del usuario autenticado filtradas por tipo(s).
// Body: { tipos: string[] }
export async function PATCH(req: NextRequest) {
  const { data: { user } } = await supabaseServer().auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { tipos } = await req.json() as { tipos: string[] }
  if (!Array.isArray(tipos) || tipos.length === 0) {
    return NextResponse.json({ error: 'tipos requerido' }, { status: 400 })
  }

  await supabaseAdmin()
    .from('alertas')
    .update({ leida: true })
    .eq('destinatario_id', user.id)
    .in('tipo', tipos)
    .eq('leida', false)

  return NextResponse.json({ ok: true })
}
