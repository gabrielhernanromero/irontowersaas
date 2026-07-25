import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { generarPasswordTemporal } from '@/lib/auth/loginPolicy'
import { logAuthEvent, getRequestIp } from '@/lib/auth/logAuthEvent'
import { sendCredenciales } from '@/lib/email/sendCredenciales'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let actor
  try {
    actor = await requireRole('admin')
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: usuario } = await supabaseAdmin()
    .from('users')
    .select('id, nombre, email')
    .eq('id', params.id)
    .eq('rol', 'supervisor')
    .single()

  if (!usuario) return NextResponse.json({ error: 'Supervisor no encontrado' }, { status: 404 })

  const tempPassword = generarPasswordTemporal()

  // No se toca user_metadata: updateUserById lo reemplaza entero y borraría 'rol'.
  const { error: authError } = await supabaseAdmin().auth.admin.updateUserById(usuario.id, {
    password: tempPassword,
  })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

  await supabaseAdmin()
    .from('users')
    .update({ must_change_password: true, failed_login_attempts: 0, locked_until: null })
    .eq('id', usuario.id)

  await logAuthEvent({
    email: usuario.email,
    evento: 'password_reset_admin',
    userId: usuario.id,
    actorId: actor.id,
    ip: getRequestIp(req),
    userAgent: req.headers.get('user-agent'),
  })

  try {
    await sendCredenciales({ nombre: usuario.nombre, email: usuario.email, tempPassword, motivo: 'reseteo' })
  } catch (e) {
    console.error('[supervisores/reset-password] error enviando email:', (e as Error).message)
  }

  return NextResponse.json({ ok: true, tempPassword })
}
