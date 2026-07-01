import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkRateLimit, LIMITS } from '@/lib/rateLimit'

// Registrar o actualizar suscripción push del dispositivo
export async function POST(req: NextRequest) {
  const { data: { user } } = await supabaseServer().auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const rl = checkRateLimit(`push:${user.id}`, LIMITS.push)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiadas solicitudes.' }, { status: 429 })
  }

  const subscription = await req.json()
  if (!subscription?.endpoint) return NextResponse.json({ error: 'Suscripción inválida' }, { status: 400 })

  await supabaseAdmin()
    .from('push_subscriptions')
    .upsert(
      { user_id: user.id, endpoint: subscription.endpoint, subscription },
      { onConflict: 'user_id,endpoint' },
    )

  return NextResponse.json({ ok: true })
}

// Eliminar suscripción (el usuario desactiva notificaciones)
export async function DELETE(req: NextRequest) {
  const { data: { user } } = await supabaseServer().auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { endpoint } = await req.json()
  if (!endpoint) return NextResponse.json({ error: 'Endpoint requerido' }, { status: 400 })

  await supabaseAdmin()
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint)

  return NextResponse.json({ ok: true })
}
