import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const CreateUsuarioSchema = z.object({
  nombre:     z.string().min(1, 'Nombre requerido'),
  apellido:   z.string().min(1, 'Apellido requerido'),
  dni:        z.string().regex(/^\d{7,8}$/, 'El DNI debe tener 7 u 8 dígitos numéricos'),
  email:      z.string().email('El email no tiene un formato válido (ej: nombre@dominio.com)'),
  password:   z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  cliente_id: z.string().uuid('Empresa inválida').optional(),
})

export async function GET() {
  try {
    await requireRole('supervisor', 'admin')
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin()
    .from('users')
    .select('id, nombre, apellido, dni, email, rol, activo, turno_habitual, cliente_id, created_at')
    .eq('rol', 'tecnico')
    .order('apellido', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ usuarios: data })
}

export async function POST(req: NextRequest) {
  try {
    await requireRole('supervisor', 'admin')
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = CreateUsuarioSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const { nombre, apellido, dni, email, password, cliente_id } = parsed.data

  // Verificar DNI duplicado
  const { data: existeDNI } = await supabaseAdmin()
    .from('users')
    .select('id')
    .eq('dni', dni)
    .maybeSingle()
  if (existeDNI) {
    return NextResponse.json(
      { error: 'Ya existe un técnico con ese DNI. Revisá el número ingresado.', field: 'dni' },
      { status: 409 }
    )
  }

  // Crear usuario en Supabase Auth — user_metadata.rol es leído por el login para el redirect
  const { data: authData, error: authError } = await supabaseAdmin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { rol: 'tecnico', nombre, apellido },
  })

  if (authError) {
    if (authError.message.includes('already registered')) {
      return NextResponse.json(
        { error: 'Ya existe un usuario con ese email. Usá otro o recuperá el acceso.', field: 'email' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  // Insertar perfil en public.users
  const { error: profileError } = await supabaseAdmin()
    .from('users')
    .insert({
      id: authData.user.id,
      email,
      nombre,
      apellido,
      dni,
      rol: 'tecnico',
      activo: true,
      cliente_id: cliente_id ?? null,
    })

  if (profileError) {
    await supabaseAdmin().auth.admin.deleteUser(authData.user.id)
    if (profileError.code === '23505' && profileError.message.includes('dni')) {
      return NextResponse.json(
        { error: 'Ya existe un técnico con ese DNI.', field: 'dni' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: authData.user.id }, { status: 201 })
}
