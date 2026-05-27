import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const CreateElementoSchema = z.object({
  nombre:             z.string().min(1, 'Nombre requerido'),
  codigo_patrimonial: z.string().min(1, 'Código patrimonial requerido'),
  categoria:          z.string().optional(),
  descripcion:        z.string().optional(),
  cliente_id:         z.string().uuid('Puesto requerido'),
  estado_admin:       z.enum(['activo', 'en_mantenimiento', 'inactivo']).default('activo'),
})

const UpdateElementoSchema = CreateElementoSchema.extend({
  id: z.string().uuid(),
})

export async function GET() {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin()
    .from('elementos_puesto')
    .select('*, clientes(id, nombre_empresa)')
    .order('nombre', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ elementos: data })
}

export async function POST(req: NextRequest) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = CreateElementoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin()
    .from('elementos_puesto')
    .insert(parsed.data)
    .select('*, clientes(id, nombre_empresa)')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Ya existe un elemento con ese código patrimonial' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, elemento: data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = UpdateElementoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const { id, ...fields } = parsed.data

  const { data, error } = await supabaseAdmin()
    .from('elementos_puesto')
    .update(fields)
    .eq('id', id)
    .select('*, clientes(id, nombre_empresa)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, elemento: data })
}
