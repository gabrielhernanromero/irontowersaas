import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const SELECT = 'id, nombre_empresa, cuit, direccion, contacto_nombre, contacto_email, contacto_telefono, activo, frecuencia_ronda_minutos, aviso_ronda_minutos, created_at'

const PuestoSchema = z.object({
  nombre_empresa:           z.string().min(1, 'Nombre del puesto requerido'),
  cuit:                     z.string().min(11, 'CUIT inválido').max(13),
  direccion:                z.string().min(1, 'Dirección requerida'),
  contacto_nombre:          z.string().min(1, 'Contacto requerido'),
  contacto_email:           z.string().email('Email inválido'),
  contacto_telefono:        z.string().min(1, 'Teléfono requerido'),
  frecuencia_ronda_minutos: z.number().int().positive().nullable().optional(),
  aviso_ronda_minutos:      z.number().int().min(1).max(60).optional(),
})

const UpdatePuestoSchema   = PuestoSchema.extend({ id: z.string().uuid() })
const ToggleActivoSchema   = z.object({ id: z.string().uuid(), activo: z.boolean() })
const FrecuenciaSchema     = z.object({
  id:                       z.string().uuid(),
  frecuencia_ronda_minutos: z.number().int().positive().nullable(),
  aviso_ronda_minutos:      z.number().int().min(1).max(120).optional(),
})

export async function GET() {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin()
    .from('clientes')
    .select(SELECT)
    .order('nombre_empresa', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ puestos: data })
}

export async function POST(req: NextRequest) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body   = await req.json()
  const parsed = PuestoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin()
    .from('clientes')
    .insert(parsed.data)
    .select(SELECT)
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Ya existe un puesto con ese CUIT' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, puesto: data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json()

  // Toggle activo (soft-delete / reactivar)
  const toggle = ToggleActivoSchema.safeParse(body)
  if (toggle.success) {
    const { data, error } = await supabaseAdmin()
      .from('clientes')
      .update({ activo: toggle.data.activo })
      .eq('id', toggle.data.id)
      .select(SELECT)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, puesto: data })
  }

  // Actualización de frecuencia de rondas
  const frec = FrecuenciaSchema.safeParse(body)
  if (frec.success) {
    const { id, ...fields } = frec.data
    const { data, error } = await supabaseAdmin()
      .from('clientes')
      .update(fields)
      .eq('id', id)
      .select(SELECT)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, puesto: data })
  }

  // Edición completa
  const parsed = UpdatePuestoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const { id, ...fields } = parsed.data
  const { data, error } = await supabaseAdmin()
    .from('clientes')
    .update(fields)
    .eq('id', id)
    .select(SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, puesto: data })
}
