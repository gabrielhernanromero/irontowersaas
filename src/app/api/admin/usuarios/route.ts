import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const CreateUsuarioSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido'),
  apellido: z.string().min(1, 'Apellido requerido'),
  dni: z.string().min(7, 'DNI inválido').max(9),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  turno_habitual: z.enum(['diurno', 'nocturno']),
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

  const { nombre, apellido, dni, email, password, turno_habitual, cliente_id } = parsed.data

  // Crear usuario en Supabase Auth
  const { data: authData, error: authError } = await supabaseAdmin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) {
    if (authError.message.includes('already registered')) {
      return NextResponse.json({ error: 'Ya existe un usuario con ese email' }, { status: 409 })
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
      turno_habitual,
      cliente_id: cliente_id ?? null,
    })

  if (profileError) {
    // Rollback: borrar el usuario de Auth si falló el perfil
    await supabaseAdmin().auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: authData.user.id }, { status: 201 })
}
