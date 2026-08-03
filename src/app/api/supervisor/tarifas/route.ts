import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const TIPOS = ['diurno', 'nocturno', 'feriado_nacional', 'feriado_puente'] as const

const UpsertTarifaSchema = z.object({
  tipo:       z.enum(TIPOS),
  valor:      z.number().min(0, 'El valor no puede ser negativo'),
  tecnicoId:  z.string().uuid().nullable().optional(),
})

// Solo admin: es sueldo real, más sensible que el conteo de turnos que ven
// supervisor+admin en /api/supervisor/personal/horas.
export async function GET() {
  try { await requireRole('admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin()
    .from('tarifas_turno')
    .select('id, tecnico_id, tipo, valor, updated_at, users(nombre, apellido)')
    .order('tipo', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tarifas: data })
}

// Crea o actualiza (según exista ya una fila para ese tipo + técnico). No se
// usa .upsert() porque la unicidad se garantiza con índices únicos
// PARCIALES (WHERE tecnico_id IS [NOT] NULL), que Postgrest no puede
// referenciar como target de ON CONFLICT.
export async function POST(req: NextRequest) {
  try { await requireRole('admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = UpsertTarifaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }
  const { tipo, valor, tecnicoId } = parsed.data
  const admin = supabaseAdmin()

  let existente = admin.from('tarifas_turno').select('id').eq('tipo', tipo)
  existente = tecnicoId ? existente.eq('tecnico_id', tecnicoId) : existente.is('tecnico_id', null)
  const { data: filaExistente } = await existente.maybeSingle()

  const query = filaExistente
    ? admin.from('tarifas_turno').update({ valor, updated_at: new Date().toISOString() }).eq('id', filaExistente.id)
    : admin.from('tarifas_turno').insert({ tipo, valor, tecnico_id: tecnicoId ?? null })

  const { data, error } = await query.select('id, tecnico_id, tipo, valor, updated_at').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, tarifa: data }, { status: filaExistente ? 200 : 201 })
}
