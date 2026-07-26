import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { generarPasswordTemporal } from '@/lib/auth/loginPolicy'
import { logAuthEvent, getRequestIp } from '@/lib/auth/logAuthEvent'
import { sendCredenciales } from '@/lib/email/sendCredenciales'
import { z } from 'zod'

const CreateSupervisorSchema = z.object({
  nombre:   z.string().min(1, 'Nombre requerido'),
  apellido: z.string().min(1, 'Apellido requerido'),
  dni:      z.string().regex(/^\d{7,8}$/, 'El DNI debe tener 7 u 8 dígitos numéricos'),
  email:    z.string().email('El email no tiene un formato válido'),
})

export async function GET() {
  try {
    await requireRole('admin')
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin()
    .from('users')
    .select('id, nombre, apellido, dni, email, rol, activo, created_at')
    .eq('rol', 'supervisor')
    .order('apellido', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ supervisores: data })
}

export async function POST(req: NextRequest) {
  let actor
  try {
    actor = await requireRole('admin')
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = CreateSupervisorSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const { nombre, apellido, dni, email } = parsed.data
  const tempPassword = generarPasswordTemporal()

  const { data: existeDNI } = await supabaseAdmin()
    .from('users')
    .select('id')
    .eq('dni', dni)
    .maybeSingle()
  if (existeDNI) {
    return NextResponse.json(
      { error: 'Ya existe un usuario con ese DNI. Revisá el número ingresado.', field: 'dni' },
      { status: 409 }
    )
  }

  const { data: authData, error: authError } = await supabaseAdmin().auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { rol: 'supervisor', nombre, apellido },
  })

  if (authError) {
    if (authError.message.includes('already registered')) {
      return NextResponse.json(
        { error: 'Ya existe un usuario con ese email.', field: 'email' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  const { error: profileError } = await supabaseAdmin()
    .from('users')
    .insert({
      id: authData.user.id,
      email,
      nombre,
      apellido,
      dni,
      rol: 'supervisor',
      activo: true,
      must_change_password: true,
    })

  if (profileError) {
    await supabaseAdmin().auth.admin.deleteUser(authData.user.id)
    if (profileError.code === '23505' && profileError.message.includes('dni')) {
      return NextResponse.json(
        { error: 'Ya existe un usuario con ese DNI.', field: 'dni' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  await logAuthEvent({
    email,
    evento: 'usuario_creado',
    userId: authData.user.id,
    actorId: actor.id,
    ip: getRequestIp(req),
    userAgent: req.headers.get('user-agent'),
  })

  try {
    await sendCredenciales({ nombre, email, tempPassword, motivo: 'alta' })
  } catch (e) {
    console.error('[admin/supervisores] error enviando email de credenciales:', (e as Error).message)
  }

  return NextResponse.json({ ok: true, id: authData.user.id, tempPassword }, { status: 201 })
}
