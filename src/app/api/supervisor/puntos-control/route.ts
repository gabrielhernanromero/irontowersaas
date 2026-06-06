import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const CreateSchema = z.object({
  cliente_id:  z.string().uuid(),
  nombre:      z.string().min(1, 'Nombre requerido'),
  descripcion: z.string().optional(),
  ubicacion:   z.string().optional(),
  orden:       z.number().int().min(0).optional(),
})

const UpdateSchema = CreateSchema.partial().extend({ id: z.string().uuid() })
const ToggleSchema = z.object({ id: z.string().uuid(), activo: z.boolean() })

export async function GET(req: NextRequest) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const clienteId = req.nextUrl.searchParams.get('cliente_id')
  let query = supabaseAdmin()
    .from('puntos_control')
    .select('id, cliente_id, nombre, descripcion, ubicacion, codigo_qr, orden, activo, created_at')
    .order('orden', { ascending: true })

  if (clienteId) query = query.eq('cliente_id', clienteId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ puntos: data })
}

export async function POST(req: NextRequest) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body   = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })

  // Validar orden único para este cliente
  if (parsed.data.orden !== undefined) {
    const { data: dup } = await supabaseAdmin()
      .from('puntos_control')
      .select('id, nombre')
      .eq('cliente_id', parsed.data.cliente_id)
      .eq('orden', parsed.data.orden)
      .maybeSingle()
    if (dup) return NextResponse.json(
      { error: `El orden ${parsed.data.orden} ya está asignado al punto "${dup.nombre}"` },
      { status: 409 }
    )
  }

  const { data, error } = await supabaseAdmin()
    .from('puntos_control')
    .insert(parsed.data)
    .select('id, cliente_id, nombre, descripcion, ubicacion, codigo_qr, orden, activo, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, punto: data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json()

  const toggle = ToggleSchema.safeParse(body)
  if (toggle.success) {
    const { data, error } = await supabaseAdmin()
      .from('puntos_control')
      .update({ activo: toggle.data.activo })
      .eq('id', toggle.data.id)
      .select('id, activo')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, punto: data })
  }

  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })

  const { id, ...fields } = parsed.data

  // Validar orden único al editar (excluir el propio punto)
  if (fields.orden !== undefined && fields.cliente_id) {
    const { data: dup } = await supabaseAdmin()
      .from('puntos_control')
      .select('id, nombre')
      .eq('cliente_id', fields.cliente_id)
      .eq('orden', fields.orden)
      .neq('id', id!)
      .maybeSingle()
    if (dup) return NextResponse.json(
      { error: `El orden ${fields.orden} ya está asignado al punto "${dup.nombre}"` },
      { status: 409 }
    )
  }

  const { data, error } = await supabaseAdmin()
    .from('puntos_control')
    .update(fields)
    .eq('id', id!)
    .select('id, cliente_id, nombre, descripcion, ubicacion, codigo_qr, orden, activo, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, punto: data })
}

export async function DELETE(req: NextRequest) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const { error } = await supabaseAdmin()
    .from('puntos_control')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
