import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const ResolverSchema = z.object({
  observacion: z.string().min(10, 'Describí la resolución (mínimo 10 caracteres)').max(1000),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { data: { user }, error: authErr } = await supabaseServer().auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // Solo supervisores y admins pueden resolver alertas
  const { data: perfil } = await supabaseAdmin()
    .from('users')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!perfil || !['supervisor', 'admin'].includes(perfil.rol)) {
    return NextResponse.json({ error: 'Sin permisos para resolver alertas' }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = ResolverSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors.observacion?.[0] ?? 'Datos inválidos' }, { status: 422 })
  }

  // La alerta debe pertenecerle al supervisor actual y ser de tipo ronda_vencida
  const { data: alerta } = await supabaseAdmin()
    .from('alertas')
    .select('id, tipo, resuelta')
    .eq('id', params.id)
    .eq('destinatario_id', user.id)
    .single()

  if (!alerta) {
    return NextResponse.json({ error: 'Alerta no encontrada' }, { status: 404 })
  }
  if (alerta.tipo !== 'ronda_vencida') {
    return NextResponse.json({ error: 'Solo se pueden resolver alertas de ronda vencida' }, { status: 400 })
  }
  if (alerta.resuelta) {
    return NextResponse.json({ error: 'La alerta ya fue resuelta' }, { status: 409 })
  }

  const { error } = await supabaseAdmin()
    .from('alertas')
    .update({
      resuelta:               true,
      resuelta_en:            new Date().toISOString(),
      resolucion_observacion: parsed.data.observacion,
      resuelta_por:           user.id,
      leida:                  true,
    })
    .eq('id', params.id)

  if (error) {
    return NextResponse.json({ error: 'Error al resolver la alerta' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
