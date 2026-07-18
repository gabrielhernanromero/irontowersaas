import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const SELECT_FIELDS = 'id, planilla_tipo_id, clave, etiqueta, orden, tipo_campo, opciones, valor_min, valor_max'

const OpcionesSchema = z.array(z.string().min(1)).refine(
  (arr) => new Set(arr).size === arr.length,
  { message: 'No puede haber opciones repetidas' }
)

function slugifyClave(etiqueta: string): string {
  return etiqueta
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

const CreateSchema = z.object({
  planilla_tipo_id: z.string().uuid(),
  etiqueta: z.string().min(1, 'Etiqueta requerida'),
  orden: z.number().int().min(0).optional(),
  tipo_campo: z.enum(['check', 'select', 'texto', 'numero', 'fecha', 'ubicacion']).optional(),
  opciones: OpcionesSchema.optional(),
  valor_min: z.number().nullable().optional(),
  valor_max: z.number().nullable().optional(),
}).refine(
  (data) => data.valor_min == null || data.valor_max == null || data.valor_min <= data.valor_max,
  { message: 'El mínimo no puede ser mayor que el máximo', path: ['valor_min'] }
)

const UpdateSchema = z.object({
  id: z.string().uuid(),
  etiqueta: z.string().min(1).optional(),
  orden: z.number().int().min(0).optional(),
  opciones: OpcionesSchema.optional(),
  valor_min: z.number().nullable().optional(),
  valor_max: z.number().nullable().optional(),
}).refine(
  (data) => data.valor_min == null || data.valor_max == null || data.valor_min <= data.valor_max,
  { message: 'El m\u00ednimo no puede ser mayor que el m\u00e1ximo', path: ['valor_min'] }
)

export async function GET(req: NextRequest) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const tipoId = req.nextUrl.searchParams.get('planilla_tipo_id')
  if (!tipoId) return NextResponse.json({ error: 'planilla_tipo_id requerido' }, { status: 400 })

  const { data, error } = await supabaseAdmin()
    .from('planilla_tipo_campos')
    .select(SELECT_FIELDS)
    .eq('planilla_tipo_id', tipoId)
    .order('orden', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campos: data })
}

export async function POST(req: NextRequest) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })

  const clave = slugifyClave(parsed.data.etiqueta)
  if (!clave) return NextResponse.json({ error: 'Etiqueta inválida' }, { status: 400 })

  const admin = supabaseAdmin()

  const { data: dup } = await admin
    .from('planilla_tipo_campos')
    .select('id')
    .eq('planilla_tipo_id', parsed.data.planilla_tipo_id)
    .eq('clave', clave)
    .maybeSingle()
  if (dup) return NextResponse.json({ error: `Ya existe un campo "${parsed.data.etiqueta}"` }, { status: 409 })

  const { data, error } = await admin
    .from('planilla_tipo_campos')
    .insert({
      planilla_tipo_id: parsed.data.planilla_tipo_id,
      etiqueta: parsed.data.etiqueta,
      clave,
      orden: parsed.data.orden ?? 0,
      tipo_campo: parsed.data.tipo_campo ?? 'check',
      ...(parsed.data.opciones !== undefined && { opciones: parsed.data.opciones }),
      ...(parsed.data.valor_min !== undefined && { valor_min: parsed.data.valor_min }),
      ...(parsed.data.valor_max !== undefined && { valor_max: parsed.data.valor_max }),
    })
    .select(SELECT_FIELDS)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, campo: data }, { status: 201 })
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
    .from('planilla_tipo_campos')
    .update(fields)
    .eq('id', id)
    .select(SELECT_FIELDS)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, campo: data })
}

export async function DELETE(req: NextRequest) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const { error } = await supabaseAdmin()
    .from('planilla_tipo_campos')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
