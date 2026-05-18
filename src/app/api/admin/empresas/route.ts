import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const CreateEmpresaSchema = z.object({
  nombre_empresa: z.string().min(1, 'Nombre requerido'),
  cuit: z.string().min(11, 'CUIT inválido').max(13),
  direccion: z.string().min(1, 'Dirección requerida'),
  contacto_nombre: z.string().min(1, 'Contacto requerido'),
  contacto_email: z.string().email('Email inválido'),
  contacto_telefono: z.string().min(1, 'Teléfono requerido'),
})

export async function GET() {
  try {
    await requireRole('supervisor', 'admin')
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin()
    .from('clientes')
    .select(`
      id, nombre_empresa, cuit, direccion, contacto_nombre, contacto_email, contacto_telefono, created_at,
      users!users_cliente_id_fkey (id, nombre, apellido, dni, turno_habitual, activo)
    `)
    .order('nombre_empresa', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ empresas: data })
}

export async function POST(req: NextRequest) {
  try {
    await requireRole('supervisor', 'admin')
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = CreateEmpresaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin()
    .from('clientes')
    .insert(parsed.data)
    .select('id, nombre_empresa, cuit, direccion, contacto_nombre, contacto_email, contacto_telefono, created_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Ya existe una empresa con ese CUIT' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, empresa: data }, { status: 201 })
}
