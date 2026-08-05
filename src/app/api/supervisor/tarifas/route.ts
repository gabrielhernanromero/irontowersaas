import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getArgTime } from '@/lib/cobertura/timeUtils'
import { z } from 'zod'

const TIPOS = ['diurno', 'nocturno', 'feriado_nacional', 'feriado_puente'] as const

// La excepción de un técnico (tecnicoId presente) es un precio único, sin
// tipo — por eso tipo es requerido solo para la tarifa base.
const UpsertTarifaSchema = z.object({
  tipo:       z.enum(TIPOS).optional(),
  valor:      z.number().min(0, 'El valor no puede ser negativo'),
  tecnicoId:  z.string().uuid().nullable().optional(),
}).refine((v) => v.tecnicoId || v.tipo, { message: 'Falta el tipo de turno' })

// supervisor+admin: hoy en Iron Tower los supervisores son los dueños. Si
// algún cliente del SaaS tiene un supervisor contratado que no sea dueño,
// revisar esto (es sueldo real).
export async function GET() {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Devuelve el historial completo (no solo la vigente): el cliente arma
  // los valores actuales tomando, por tipo/técnico, la fila con
  // vigente_desde más reciente.
  const { data, error } = await supabaseAdmin()
    .from('tarifas_turno')
    .select('id, tecnico_id, tipo, valor, vigente_desde, users(nombre, apellido)')
    .order('vigente_desde', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tarifas: data })
}

// Fecha sentinela para "cubre todo el historial real" — se usa solo la
// primera vez que se carga una tarifa en todo el sistema (ver más abajo).
const DESDE_SIEMPRE = '2000-01-01'

// Un cambio de tarifa NUNCA pisa el valor anterior: inserta una fila nueva
// vigente desde hoy. Así, el cálculo de $ de turnos ya trabajados (que usa
// la tarifa vigente en la fecha de CADA turno) no se modifica
// retroactivamente cuando se edita una tarifa.
//
// Excepción: si esta es la PRIMERÍSIMA tarifa que se carga en todo el
// sistema (la tabla está vacía), se guarda con vigencia "desde siempre" en
// vez de "desde hoy" — antes de esa carga no había ningún $ calculado en
// ningún lado, así que cubrir el historial completo no le cambia el valor
// a ningún turno ya mostrado. Cualquier tarifa posterior (un tipo nuevo,
// una excepción de técnico, o una edición) sí arranca desde hoy nomás,
// porque en ese punto ya hay números calculados que no hay que tocar.
export async function POST(req: NextRequest) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = UpsertTarifaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }
  const { valor, tecnicoId } = parsed.data
  const tipo = tecnicoId ? null : parsed.data.tipo! // garantizado por el refine de arriba
  const admin = supabaseAdmin()
  const { hoy } = getArgTime()

  let existente = admin.from('tarifas_turno').select('id').eq('vigente_desde', hoy)
  existente = tecnicoId
    ? existente.eq('tecnico_id', tecnicoId).is('tipo', null)
    : existente.is('tecnico_id', null).eq('tipo', tipo!)
  const { data: filaDeHoy } = await existente.maybeSingle()

  let query
  if (filaDeHoy) {
    query = admin.from('tarifas_turno').update({ valor }).eq('id', filaDeHoy.id)
  } else {
    const { count } = await admin.from('tarifas_turno').select('id', { count: 'exact', head: true })
    const esLaPrimeraDeTodas = (count ?? 0) === 0
    query = admin.from('tarifas_turno').insert({
      tipo, valor, tecnico_id: tecnicoId ?? null,
      vigente_desde: esLaPrimeraDeTodas ? DESDE_SIEMPRE : hoy,
    })
  }

  const { data, error } = await query.select('id, tecnico_id, tipo, valor, vigente_desde').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, tarifa: data }, { status: filaDeHoy ? 200 : 201 })
}
