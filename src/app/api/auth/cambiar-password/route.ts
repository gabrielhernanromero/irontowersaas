import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { logAuthEvent, getRequestIp } from '@/lib/auth/logAuthEvent'
import { ROLE_REDIRECTS } from '@/lib/auth/roleRedirects'
import type { Rol } from '@/types/database'

const CambiarPasswordSchema = z
  .object({
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    confirmPassword: z.string(),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const parsed = CambiarPasswordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const server = supabaseServer()
  const { data: { user: authUser } } = await server.auth.getUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Sesión inválida. Volvé a pedir el link de recuperación.' }, { status: 401 })
  }

  const { error: updateError } = await server.auth.updateUser({ password: parsed.data.password })
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  const { data: perfil } = await supabaseAdmin()
    .from('users')
    .update({ must_change_password: false })
    .eq('id', authUser.id)
    .select('rol')
    .single()

  await logAuthEvent({
    email: authUser.email ?? '',
    evento: 'password_change_self',
    userId: authUser.id,
    ip: getRequestIp(req),
    userAgent: req.headers.get('user-agent'),
  })

  const redirectTo = ROLE_REDIRECTS[(perfil?.rol as Rol) ?? 'tecnico'] ?? '/login'
  return NextResponse.json({ ok: true, redirectTo })
}
