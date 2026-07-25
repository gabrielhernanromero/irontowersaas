import { supabaseAdmin } from '@/lib/supabase/admin'
import { itemTieneNovedad, type CampoDef } from '@/lib/validations/planillaGenerica'
import type { PlanillaSnapshotConfig } from '@/types/database'

export interface MetricasConfiabilidad {
  rondas: { total: number; completas: number; porcentajeCumplimiento: number }
  incidenciasLibro: number
  incidenciasPlanillas: number
  elementosConMasFallas: { tipoPlanilla: string; numero: string; fallas: number }[]
  interno: {
    tecnicoMasIncidencias: { tecnicoId: string; nombre: string; cantidad: number } | null
    tecnicoMasRondasIncompletas: { tecnicoId: string; nombre: string; cantidad: number } | null
  }
}

const TOP_ELEMENTOS = 5

function topDeMap(m: Map<string, number>, nombres: Map<string, string>) {
  let top: { tecnicoId: string; cantidad: number } | null = null
  for (const [tecnicoId, cantidad] of Array.from(m.entries())) {
    if (!top || cantidad > top.cantidad) top = { tecnicoId, cantidad }
  }
  if (!top) return null
  return { tecnicoId: top.tecnicoId, cantidad: top.cantidad, nombre: nombres.get(top.tecnicoId) ?? 'Desconocido' }
}

// Agrega, para un cliente y un rango de fechas, las métricas del Informe de
// Confiabilidad. Reutiliza el mismo criterio de "novedad" que usan el PDF de
// planilla individual y el historial de supervisor (itemTieneNovedad para
// planillas genéricas, las mismas 2 condiciones fijas para legacy) — no se
// reimplementa ese criterio acá.
export async function calcularMetricasConfiabilidad(
  admin: ReturnType<typeof supabaseAdmin>,
  clienteId: string,
  fechaDesde: string,
  fechaHasta: string,
): Promise<MetricasConfiabilidad> {
  const [rondasRes, libroRes, planillasRes] = await Promise.all([
    admin
      .from('rondas')
      .select('id, completa, tecnico_id')
      .eq('cliente_id', clienteId)
      .gte('hora_inicio', fechaDesde)
      .lte('hora_inicio', `${fechaHasta} 23:59:59`),
    admin
      .from('libro_novedad')
      .select('id, tipo, tecnico_id, libro_turno!inner(cliente_id, fecha)')
      .eq('libro_turno.cliente_id', clienteId)
      .gte('libro_turno.fecha', fechaDesde)
      .lte('libro_turno.fecha', fechaHasta),
    admin
      .from('planillas')
      .select('id, tipo, tecnico_id, snapshot_config')
      .eq('cliente_id', clienteId)
      .gte('fecha', fechaDesde)
      .lte('fecha', fechaHasta),
  ])

  const rondas = rondasRes.data ?? []
  const totalRondas = rondas.length
  const rondasCompletas = rondas.filter((r) => r.completa).length
  const porcentajeCumplimiento = totalRondas === 0 ? 0 : Math.round((rondasCompletas / totalRondas) * 100)

  const rondasIncompletasPorTecnico = new Map<string, number>()
  for (const r of rondas) {
    if (!r.completa) {
      rondasIncompletasPorTecnico.set(r.tecnico_id, (rondasIncompletasPorTecnico.get(r.tecnico_id) ?? 0) + 1)
    }
  }

  // 'ronda' lo inserta automáticamente el trigger fn_novedad_ronda_completada
  // al completarse una ronda — no es una incidencia real. 'apertura'/'cierre'/
  // 'sistema' tampoco. Solo 'novedad' y 'alerta' son incidencias reportadas.
  const novedadesLibro = (libroRes.data ?? []).filter((n) => n.tipo === 'novedad' || n.tipo === 'alerta')
  const incidenciasPorTecnico = new Map<string, number>()
  for (const n of novedadesLibro) {
    incidenciasPorTecnico.set(n.tecnico_id, (incidenciasPorTecnico.get(n.tecnico_id) ?? 0) + 1)
  }

  const planillas = planillasRes.data ?? []
  const planillaIds = planillas.map((p) => p.id)
  const planillaById = new Map(planillas.map((p) => [p.id, p]))

  let incidenciasPlanillas = 0
  const fallasPorElemento = new Map<string, number>()

  const sumarFalla = (tipoPlanilla: string, numero: string) => {
    const key = `${tipoPlanilla}:${numero}`
    fallasPorElemento.set(key, (fallasPorElemento.get(key) ?? 0) + 1)
  }
  const sumarIncidenciaTecnico = (tecnicoId: string) => {
    incidenciasPorTecnico.set(tecnicoId, (incidenciasPorTecnico.get(tecnicoId) ?? 0) + 1)
  }

  if (planillaIds.length > 0) {
    const [genericoRes, hidrantesRes, extintoresRes] = await Promise.all([
      admin.from('planilla_item_respuestas').select('planilla_id, numero, respuestas').in('planilla_id', planillaIds),
      admin.from('planilla_hidrantes').select('planilla_id, numero, gabinete, manga, lanza, valvula').in('planilla_id', planillaIds),
      admin.from('planilla_extintores').select('planilla_id, numero, senalizacion, acceso, presion_peso').in('planilla_id', planillaIds),
    ])

    // Config de campos por planilla genérica: snapshot_config si la planilla
    // ya lo tiene (mismo criterio que el PDF individual — el informe usa la
    // config vigente al momento del envío, no la actual), si no, mejor
    // esfuerzo con planilla_tipos/planilla_tipo_campos vigentes.
    const planillasSinSnapshot = planillas.filter((p) => !p.snapshot_config)
    const camposPorTipoSlug = new Map<string, CampoDef[]>()
    const slugsUnicos = Array.from(new Set(planillasSinSnapshot.map((p) => p.tipo)))
    for (const slug of slugsUnicos) {
      const { data: tipoGenerico } = await admin
        .from('planilla_tipos')
        .select('id')
        .eq('cliente_id', clienteId)
        .eq('slug', slug)
        .single()
      if (tipoGenerico) {
        const { data: camposData } = await admin
          .from('planilla_tipo_campos')
          .select('clave, etiqueta, tipo_campo, opciones, valor_min, valor_max')
          .eq('planilla_tipo_id', tipoGenerico.id)
          .order('orden')
        camposPorTipoSlug.set(slug, (camposData ?? []) as CampoDef[])
      }
    }

    const camposDe = (planillaId: string): CampoDef[] => {
      const p = planillaById.get(planillaId)
      if (!p) return []
      if (p.snapshot_config) return (p.snapshot_config as PlanillaSnapshotConfig).campos
      return camposPorTipoSlug.get(p.tipo) ?? []
    }

    for (const item of genericoRes.data ?? []) {
      const campos = camposDe(item.planilla_id)
      if (campos.length > 0 && itemTieneNovedad({ respuestas: item.respuestas as Record<string, unknown> }, campos)) {
        incidenciasPlanillas++
        const p = planillaById.get(item.planilla_id)
        if (p) {
          sumarFalla(p.tipo, item.numero)
          sumarIncidenciaTecnico(p.tecnico_id)
        }
      }
    }

    for (const item of hidrantesRes.data ?? []) {
      if (!item.gabinete || !item.manga || !item.lanza || !item.valvula) {
        incidenciasPlanillas++
        sumarFalla('hidrantes', item.numero)
        const p = planillaById.get(item.planilla_id)
        if (p) sumarIncidenciaTecnico(p.tecnico_id)
      }
    }

    for (const item of extintoresRes.data ?? []) {
      if (!item.senalizacion || !item.acceso || !item.presion_peso) {
        incidenciasPlanillas++
        sumarFalla('extintores', item.numero)
        const p = planillaById.get(item.planilla_id)
        if (p) sumarIncidenciaTecnico(p.tecnico_id)
      }
    }
  }

  const elementosConMasFallas = Array.from(fallasPorElemento.entries())
    .map(([key, fallas]) => {
      const [tipoPlanilla, numero] = key.split(':')
      return { tipoPlanilla, numero, fallas }
    })
    .sort((a, b) => b.fallas - a.fallas)
    .slice(0, TOP_ELEMENTOS)

  const rondasTecnicoIds = Array.from(rondasIncompletasPorTecnico.keys())
  const incidenciasTecnicoIds = Array.from(incidenciasPorTecnico.keys())
  const tecnicoIdsRelevantes = Array.from(new Set([...rondasTecnicoIds, ...incidenciasTecnicoIds]))
  const nombresPorTecnico = new Map<string, string>()
  if (tecnicoIdsRelevantes.length > 0) {
    const { data: tecnicos } = await admin.from('users').select('id, nombre, apellido').in('id', tecnicoIdsRelevantes)
    for (const t of tecnicos ?? []) nombresPorTecnico.set(t.id, `${t.nombre} ${t.apellido}`)
  }

  return {
    rondas: { total: totalRondas, completas: rondasCompletas, porcentajeCumplimiento },
    incidenciasLibro: novedadesLibro.length,
    incidenciasPlanillas,
    elementosConMasFallas,
    interno: {
      tecnicoMasIncidencias: topDeMap(incidenciasPorTecnico, nombresPorTecnico),
      tecnicoMasRondasIncompletas: topDeMap(rondasIncompletasPorTecnico, nombresPorTecnico),
    },
  }
}
