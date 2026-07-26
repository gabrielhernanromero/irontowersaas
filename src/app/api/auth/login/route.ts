import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { logAuthEvent, getRequestIp } from '@/lib/auth/logAuthEvent'
import { MAX_INTENTOS_LOGIN, calcularLockedUntil, estaBloqueado, minutosRestantesBloqueo } from '@/lib/auth/loginPolicy'
import { ROLE_REDIRECTS } from '@/lib/auth/roleRedirects'
import type { Rol } from '@/types/database'

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const parsed = LoginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 400 })
  }
  const { email, password } = parsed.data

  const ip = getRequestIp(req)
  const userAgent = req.headers.get('user-agent')

  const { data: perfil } = await supabaseAdmin()
    .from('users')
    .select('id, rol, activo, must_change_password, failed_login_attempts, locked_until')
    .eq('email', email)
    .maybeSingle()

  if (perfil?.locked_until && estaBloqueado(perfil.locked_until)) {
    await logAuthEvent({ email, evento: 'login_fail', userId: perfil.id, ip, userAgent })
    return NextResponse.json(
      { error: `Cuenta bloqueada temporalmente. Probá de nuevo en ${minutosRestantesBloqueo(perfil.locked_until)} minutos o pedile a tu supervisor que te la restablezca.` },
      { status: 423 }
    )
  }

  if (perfil && !perfil.activo) {
    return NextResponse.json(
      { error: 'Tu cuenta está desactivada. Contactá a tu supervisor.' },
      { status: 403 }
    )
  }

  const { data, error: authError } = await supabaseServer().auth.signInWithPassword({ email, password })

  if (authError || !data.session) {
    if (perfil) {
      const intentos = perfil.failed_login_attempts + 1
      const update: Record<string, unknown> = { failed_login_attempts: intentos }
      if (intentos >= MAX_INTENTOS_LOGIN) {
        update.locked_until = calcularLockedUntil()
      }
      await supabaseAdmin().from('users').update(update).eq('id', perfil.id)

      if (intentos >= MAX_INTENTOS_LOGIN) {
        await logAuthEvent({ email, evento: 'account_locked', userId: perfil.id, ip, userAgent })
      }
    }
    await logAuthEvent({ email, evento: 'login_fail', userId: perfil?.id ?? null, ip, userAgent })
    return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 401 })
  }

  if (perfil) {
    await supabaseAdmin()
      .from('users')
      .update({ failed_login_attempts: 0, locked_until: null, last_login_at: new Date().toISOString() })
      .eq('id', perfil.id)
    await logAuthEvent({ email, evento: 'login_ok', userId: perfil.id, ip, userAgent })
  }

  const redirectTo = perfil?.must_change_password
    ? '/cambiar-password'
    : ROLE_REDIRECTS[(perfil?.rol as Rol) ?? 'tecnico'] ?? '/login'

  return NextResponse.json({ ok: true, redirectTo })
}
