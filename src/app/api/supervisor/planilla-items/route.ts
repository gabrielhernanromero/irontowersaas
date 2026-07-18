import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const CreateSchema = z.object({
  cliente_id:    z.string().uuid(),
  tipo:          z.string().min(1, 'Tipo requerido'),
  numero:        z.string().min(1, 'Número requerido'),
  tipo_extintor: z.string().optional(),
  ubicacion:     z.string().optional(),
  orden:         z.number().int().min(0).optional(),
}).refine((data) => data.tipo === 'extintores' || !data.tipo_extintor, {
  message: 'tipo_extintor solo aplica a ítems de tipo extintores',
  path: ['tipo_extintor'],
})

const UpdateSchema = z.object({
  id:            z.string().uuid(),
  numero:        z.string().min(1).optional(),
  tipo_extintor: z.string().optional(),
  ubicacion:     z.string().optional(),
  orden:         z.number().int().min(0).optional(),
})

const ToggleSchema = z.object({ id: z.string().uuid(), activo: z.boolean() })

const SELECT_FIELDS = 'id, cliente_id, tipo, numero, tipo_extintor, ubicacion, orden, activo, created_at'

export async function GET(req: NextRequest) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const clienteId = req.nextUrl.searchParams.get('cliente_id')
  const tipo = req.nextUrl.searchParams.get('tipo')

  let query = supabaseAdmin()
    .from('planilla_items_config')
    .select(SELECT_FIELDS)
    .order('orden', { ascending: true })

  if (clienteId) query = query.eq('cliente_id', clienteId)
  if (tipo) query = query.eq('tipo', tipo)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data })
}

export async function POST(req: NextRequest) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })

  const { data: dup } = await supabaseAdmin()
    .from('planilla_items_config')
    .select('id')
    .eq('cliente_id', parsed.data.cliente_id)
    .eq('tipo', parsed.data.tipo)
    .eq('numero', parsed.data.numero)
    .maybeSingle()
  if (dup) return NextResponse.json(
    { error: `Ya existe un ítem "${parsed.data.numero}" para este cliente` },
    { status: 409 }
  )

  const { data, error } = await supabaseAdmin()
    .from('planilla_items_config')
    .insert(parsed.data)
    .select(SELECT_FIELDS)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, item: data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json()

  const toggle = ToggleSchema.safeParse(body)
  if (toggle.success && Object.keys(body).length === 2) {
    const { data, error } = await supabaseAdmin()
      .from('planilla_items_config')
      .update({ activo: toggle.data.activo })
      .eq('id', toggle.data.id)
      .select('id, activo')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, item: data })
  }

  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })

  const { id, ...fields } = parsed.data

  const { data, error } = await supabaseAdmin()
    .from('planilla_items_config')
    .update(fields)
    .eq('id', id)
    .select(SELECT_FIELDS)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, item: data })
}

export async function DELETE(req: NextRequest) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const { error } = await supabaseAdmin()
    .from('planilla_items_config')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
