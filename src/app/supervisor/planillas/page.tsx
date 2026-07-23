import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { itemTieneNovedad, type CampoDef } from '@/lib/validations/planillaGenerica'
import PlanillasSupervisorClient from './PlanillasSupervisorClient'

const LIMITE_HISTORIAL = 50

export default async function PlanillasPage({
  searchParams,
}: {
  searchParams: { tipo?: string; tecnico_id?: string; cliente_id?: string; desde?: string; hasta?: string; agrupar?: string; q?: string; filtro?: string }
}) {
  const sb = supabaseServer()

  let query = sb
    .from('planillas')
    .select(`
      id, tipo, fecha, turno, inmutable, enviada_at, created_at, tecnico_id, cliente_id, snapshot_config,
      users!tecnico_id(nombre, apellido),
      clientes(nombre_empresa)
    `)
    .order('created_at', { ascending: false })
    .limit(LIMITE_HISTORIAL)

  if (searchParams.tipo) query = query.eq('tipo', searchParams.tipo)
  if (searchParams.tecnico_id) query = query.eq('tecnico_id', searchParams.tecnico_id)
  if (searchParams.cliente_id) query = query.eq('cliente_id', searchParams.cliente_id)
  if (searchParams.desde) query = query.gte('fecha', searchParams.desde)
  if (searchParams.hasta) query = query.lte('fecha', searchParams.hasta)

  const [{ data: planillas }, { data: clientes }, { data: tecnicos }] = await Promise.all([
    query,
    sb.from('clientes').select('id, nombre_empresa').eq('activo', true).order('nombre_empresa'),
    supabaseAdmin().from('users').select('id, nombre, apellido').eq('rol', 'tecnico').order('apellido'),
  ])

  const ids = (planillas ?? []).map(p => p.id)
  const planillasConNovedad = await buscarPlanillasConNovedad(sb, ids, planillas ?? [])

  return (
    <PlanillasSupervisorClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      planillas={(planillas ?? []).map(p => ({ ...p, tieneNovedad: planillasConNovedad.has(p.id) })) as any}
      searchParams={searchParams}
      clientes={clientes ?? []}
      tecnicos={tecnicos ?? []}
      limiteAlcanzado={(planillas ?? []).length >= LIMITE_HISTORIAL}
    />
  )
}

// Regla 3/4 del proyecto: un ítem en "NO" es una novedad y dispara alerta a
// supervisores al enviarse. Acá reconstruimos esa misma señal por planilla
// para el historial, sin duplicar el criterio (reutiliza itemTieneNovedad,
// el mismo que usan el PDF y la página de detalle).
async function buscarPlanillasConNovedad(
  sb: ReturnType<typeof supabaseServer>,
  ids: string[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  planillas: any[]
): Promise<Set<string>> {
  const conNovedad = new Set<string>()
  if (ids.length === 0) return conNovedad

  const camposPorPlanilla = new Map<string, CampoDef[]>()
  for (const p of planillas) {
    if (p.snapshot_config?.campos) camposPorPlanilla.set(p.id, p.snapshot_config.campos)
  }

  const [{ data: hidrantes }, { data: extintores }, { data: generico }] = await Promise.all([
    sb.from('planilla_hidrantes').select('planilla_id, gabinete, manga, lanza, valvula').in('planilla_id', ids),
    sb.from('planilla_extintores').select('planilla_id, senalizacion, acceso, presion_peso').in('planilla_id', ids),
    sb.from('planilla_item_respuestas').select('planilla_id, respuestas').in('planilla_id', ids),
  ])

  for (const item of hidrantes ?? []) {
    if (!item.gabinete || !item.manga || !item.lanza || !item.valvula) conNovedad.add(item.planilla_id)
  }
  for (const item of extintores ?? []) {
    if (!item.senalizacion || !item.acceso || !item.presion_peso) conNovedad.add(item.planilla_id)
  }
  for (const item of generico ?? []) {
    const campos = camposPorPlanilla.get(item.planilla_id)
    if (campos && itemTieneNovedad({ respuestas: item.respuestas as Record<string, unknown> }, campos)) {
      conNovedad.add(item.planilla_id)
    }
  }

  return conNovedad
}
