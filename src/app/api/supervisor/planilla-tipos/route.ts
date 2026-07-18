import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const SELECT_FIELDS = 'id, cliente_id, nombre, slug, es_legacy, usa_motor_generico, etiqueta_numero, etiqueta_ubicacion, activo, created_at'

function slugify(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // sin acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const CreateSchema = z.object({
  cliente_id: z.string().uuid(),
  nombre: z.string().min(1, 'Nombre requerido'),
})

const UpdateSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string().min(1).optional(),
  activo: z.boolean().optional(),
  usa_motor_generico: z.boolean().optional(),
  etiqueta_numero: z.string().min(1).optional(),
  etiqueta_ubicacion: z.string().min(1).optional(),
})

export async function GET(req: NextRequest) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const clienteId = req.nextUrl.searchParams.get('cliente_id')
  if (!clienteId) return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 })

  const { data, error } = await supabaseAdmin()
    .from('planilla_tipos')
    .select(SELECT_FIELDS)
    .eq('cliente_id', clienteId)
    .order('es_legacy', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tipos: data })
}

export async function POST(req: NextRequest) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })

  const baseSlug = slugify(parsed.data.nombre)
  if (!baseSlug) return NextResponse.json({ error: 'Nombre inválido' }, { status: 400 })

  const admin = supabaseAdmin()

  // Evitar colisión de slug dentro del mismo cliente (agrega sufijo numérico)
  let slug = baseSlug
  let suffix = 2
  while (true) {
    const { data: dup } = await admin
      .from('planilla_tipos')
      .select('id')
      .eq('cliente_id', parsed.data.cliente_id)
      .eq('slug', slug)
      .maybeSingle()
    if (!dup) break
    slug = `${baseSlug}-${suffix++}`
  }

  const { data, error } = await admin
    .from('planilla_tipos')
    .insert({ cliente_id: parsed.data.cliente_id, nombre: parsed.data.nombre, slug, es_legacy: false })
    .select(SELECT_FIELDS)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, tipo: data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })

  const { id, ...fields } = parsed.data

  const { data, error } = await supabaseAdmin()
    .from('planilla_tipos')
    .update(fields)
    .eq('id', id)
    .select(SELECT_FIELDS)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, tipo: data })
}

export async function DELETE(req: NextRequest) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const admin = supabaseAdmin()

  const { data: tipo } = await admin.from('planilla_tipos').select('es_legacy, usa_motor_generico').eq('id', id).single()
  if (tipo?.es_legacy && !tipo.usa_motor_generico) {
    return NextResponse.json({ error: 'Activá primero la edición completa para poder eliminar Hidrantes/Extintores' }, { status: 409 })
  }

  const { error } = await admin.from('planilla_tipos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
