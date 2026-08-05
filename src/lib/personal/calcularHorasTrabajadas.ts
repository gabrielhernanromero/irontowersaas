import { supabaseAdmin } from '@/lib/supabase/admin'

export type TipoTurno = 'diurno' | 'nocturno'
export type TipoFeriado = 'nacional' | 'puente'
export type TipoTarifa = 'diurno' | 'nocturno' | 'feriado_nacional' | 'feriado_puente'

export interface TurnoTrabajado {
  turnoId: string
  fecha: string
  turno: TipoTurno
  rol: 'encargado' | 'apoyo'
  clienteNombre: string
  aperturaReal: string
  cierreReal: string | null
  horasTrabajadas: number | null
  feriado: { nombre: string; tipo: TipoFeriado } | null
  cierreAnticipado: boolean
  motivoCierreAnticipado: string | null
  cierreForzado: boolean
  rondas: { total: number; completas: number } | null
  aperturaTardia: boolean
  excepcion: boolean
  montoEstimado: number | null
}

export interface ResumenTecnico {
  tecnicoId: string
  nombre: string
  apellido: string
  totalTurnos: number
  turnosDiurnos: number
  turnosNocturnos: number
  turnosFeriadoNacional: number
  turnosFeriadoPuente: number
  horasTotales: number
  excepciones: number
  montoTotalEstimado: number | null
  tarifaIncompleta: boolean
  detalle: TurnoTrabajado[]
}

// Minutos de gracia antes de considerar la apertura de un turno "tardía" —
// mismo umbral que usa el cron de ausencia de encargado (GRACIA_MIN en
// src/app/api/cron/ausencia-encargado/route.ts), para no inventar un
// criterio distinto de "llegó tarde" en dos lugares del sistema.
const GRACIA_APERTURA_MIN = 15

// Argentina = UTC-3 fijo, sin horario de verano (mismo criterio que
// getArgTime en src/lib/cobertura/timeUtils.ts). Convierte un timestamp
// real (guardado en UTC) a minutos desde medianoche en hora local.
function minutosLocalArg(iso: string): number {
  const d = new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

function minutosDeHora(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

interface TurnoBase {
  id: string
  fecha: string
  turno: TipoTurno
  tecnico_id: string
  clienteNombre: string
  motivoCierreAnticipado: string | null
  horaInicioEsquema: string | null
}

// Agrega, para un rango de fechas (y opcionalmente un técnico), los turnos
// trabajados por cada técnico — como encargado (libro_turno) o como apoyo
// (participaciones_turno) — cruzando feriados, rondas y tarifas. Se cuentan
// turnos en estado 'cerrado' O 'pendiente_relevo': un turno que solo está
// esperando la firma de relevo del entrante ya fue trabajado por completo
// por el saliente.
export async function calcularHorasTrabajadas(
  admin: ReturnType<typeof supabaseAdmin>,
  params: { desde: string; hasta: string; tecnicoId?: string },
): Promise<ResumenTecnico[]> {
  const { desde, hasta, tecnicoId } = params
  const ESTADOS_CONTABLES = ['cerrado', 'pendiente_relevo']

  let queryEncargado = admin
    .from('libro_turno')
    .select(`
      id, fecha, turno, tecnico_id, motivo_cierre_anticipado,
      clientes(nombre_empresa),
      esquemas_cobertura(hora_inicio)
    `)
    .in('estado', ESTADOS_CONTABLES)
    .gte('fecha', desde)
    .lte('fecha', hasta)
  if (tecnicoId) queryEncargado = queryEncargado.eq('tecnico_id', tecnicoId)

  let queryApoyo = admin
    .from('participaciones_turno')
    .select(`
      usuario_id,
      libro_turno!inner(
        id, fecha, turno, tecnico_id, motivo_cierre_anticipado, estado,
        clientes(nombre_empresa),
        esquemas_cobertura(hora_inicio)
      )
    `)
    .in('libro_turno.estado', ESTADOS_CONTABLES)
    .gte('libro_turno.fecha', desde)
    .lte('libro_turno.fecha', hasta)
  if (tecnicoId) queryApoyo = queryApoyo.eq('usuario_id', tecnicoId)

  const [encargadoRes, apoyoRes] = await Promise.all([queryEncargado, queryApoyo])

  type EncargadoRow = {
    id: string; fecha: string; turno: TipoTurno; tecnico_id: string
    motivo_cierre_anticipado: string | null
    clientes: { nombre_empresa: string } | null
    esquemas_cobertura: { hora_inicio: string } | null
  }
  type ApoyoRow = {
    usuario_id: string
    libro_turno: {
      id: string; fecha: string; turno: TipoTurno; tecnico_id: string
      motivo_cierre_anticipado: string | null
      clientes: { nombre_empresa: string } | null
      esquemas_cobertura: { hora_inicio: string } | null
    }
  }

  const filas: { base: TurnoBase; tecnicoId: string; rol: 'encargado' | 'apoyo' }[] = []

  for (const row of (encargadoRes.data ?? []) as unknown as EncargadoRow[]) {
    filas.push({
      tecnicoId: row.tecnico_id,
      rol: 'encargado',
      base: {
        id: row.id,
        fecha: row.fecha,
        turno: row.turno,
        tecnico_id: row.tecnico_id,
        clienteNombre: row.clientes?.nombre_empresa ?? 'Sin sede',
        motivoCierreAnticipado: row.motivo_cierre_anticipado,
        horaInicioEsquema: row.esquemas_cobertura?.hora_inicio ?? null,
      },
    })
  }

  for (const row of (apoyoRes.data ?? []) as unknown as ApoyoRow[]) {
    const lt = row.libro_turno
    filas.push({
      tecnicoId: row.usuario_id,
      rol: 'apoyo',
      base: {
        id: lt.id,
        fecha: lt.fecha,
        turno: lt.turno,
        tecnico_id: lt.tecnico_id,
        clienteNombre: lt.clientes?.nombre_empresa ?? 'Sin sede',
        motivoCierreAnticipado: lt.motivo_cierre_anticipado,
        horaInicioEsquema: lt.esquemas_cobertura?.hora_inicio ?? null,
      },
    })
  }

  if (filas.length === 0) return []

  const turnoIds = Array.from(new Set(filas.map((f) => f.base.id)))

  const [novedadesRes, rondasRes, feriadosRes, tarifasRes] = await Promise.all([
    admin
      .from('libro_novedad')
      .select('turno_id, tipo, tecnico_id, created_at')
      .in('turno_id', turnoIds)
      .in('tipo', ['apertura', 'cierre']),
    admin
      .from('rondas')
      .select('turno_id, completa')
      .in('turno_id', turnoIds),
    admin
      .from('feriados')
      .select('fecha, nombre, tipo')
      .gte('fecha', desde)
      .lte('fecha', hasta),
    admin
      .from('tarifas_turno')
      .select('tecnico_id, tipo, valor, vigente_desde'),
  ])

  const novedadesPorTurno = new Map<string, { apertura?: string; cierre?: string; cierreTecnicoId?: string }>()
  for (const n of (novedadesRes.data ?? []) as { turno_id: string; tipo: string; tecnico_id: string; created_at: string }[]) {
    const entry = novedadesPorTurno.get(n.turno_id) ?? {}
    if (n.tipo === 'apertura') entry.apertura = n.created_at
    if (n.tipo === 'cierre') { entry.cierre = n.created_at; entry.cierreTecnicoId = n.tecnico_id }
    novedadesPorTurno.set(n.turno_id, entry)
  }

  const rondasPorTurno = new Map<string, { total: number; completas: number }>()
  for (const r of (rondasRes.data ?? []) as { turno_id: string | null; completa: boolean }[]) {
    if (!r.turno_id) continue
    const entry = rondasPorTurno.get(r.turno_id) ?? { total: 0, completas: 0 }
    entry.total++
    if (r.completa) entry.completas++
    rondasPorTurno.set(r.turno_id, entry)
  }

  const feriadosPorFecha = new Map<string, { nombre: string; tipo: TipoFeriado }>()
  for (const f of (feriadosRes.data ?? []) as { fecha: string; nombre: string; tipo: TipoFeriado }[]) {
    feriadosPorFecha.set(f.fecha, { nombre: f.nombre, tipo: f.tipo })
  }

  // Historial de vigencias, ordenado por fecha de inicio ascendente — un
  // cambio de tarifa NO pisa el valor anterior, agrega una fila nueva
  // "desde tal fecha". Cada turno usa la que estaba vigente en SU fecha,
  // no la más reciente, para que un cambio de tarifa nunca modifique
  // retroactivamente lo ya calculado.
  // La excepción de un técnico es un precio único (sin tipo): aplica igual
  // sea el turno diurno, nocturno o feriado — por eso va en su propio mapa
  // sin distinguir tipo, a diferencia de la tarifa base.
  type Vigencia = { vigente_desde: string; valor: number }
  const tarifaBaseHist = new Map<TipoTarifa, Vigencia[]>()
  const tarifaOverrideHist = new Map<string, Vigencia[]>() // key: tecnicoId
  for (const t of (tarifasRes.data ?? []) as { tecnico_id: string | null; tipo: TipoTarifa | null; valor: number; vigente_desde: string }[]) {
    if (t.tecnico_id) {
      const lista = tarifaOverrideHist.get(t.tecnico_id) ?? []
      lista.push({ vigente_desde: t.vigente_desde, valor: t.valor })
      tarifaOverrideHist.set(t.tecnico_id, lista)
    } else if (t.tipo) {
      const lista = tarifaBaseHist.get(t.tipo) ?? []
      lista.push({ vigente_desde: t.vigente_desde, valor: t.valor })
      tarifaBaseHist.set(t.tipo, lista)
    }
  }
  for (const lista of Array.from(tarifaBaseHist.values())) lista.sort((a, b) => a.vigente_desde.localeCompare(b.vigente_desde))
  for (const lista of Array.from(tarifaOverrideHist.values())) lista.sort((a, b) => a.vigente_desde.localeCompare(b.vigente_desde))

  function tarifaVigenteEn(historial: Vigencia[] | undefined, fecha: string): number | null {
    if (!historial) return null
    let resultado: number | null = null
    for (const v of historial) {
      if (v.vigente_desde > fecha) break
      resultado = v.valor
    }
    return resultado
  }

  const hayTarifas = tarifaBaseHist.size > 0 || tarifaOverrideHist.size > 0

  const tecnicoIds = Array.from(new Set(filas.map((f) => f.tecnicoId)))
  const { data: tecnicosData } = await admin
    .from('users')
    .select('id, nombre, apellido')
    .in('id', tecnicoIds)
  const nombresPorTecnico = new Map((tecnicosData ?? []).map((u) => [u.id, { nombre: u.nombre, apellido: u.apellido }]))

  const resumenPorTecnico = new Map<string, ResumenTecnico>()

  for (const fila of filas) {
    const { base, rol, tecnicoId: tId } = fila
    const novedad = novedadesPorTurno.get(base.id)
    const feriado = feriadosPorFecha.get(base.fecha) ?? null
    const rondas = rondasPorTurno.get(base.id) ?? null

    const cierreForzado = !!(novedad?.cierre && novedad.cierreTecnicoId && novedad.cierreTecnicoId !== base.tecnico_id)
    const aperturaReal = novedad?.apertura ?? null
    const cierreReal = cierreForzado ? null : (novedad?.cierre ?? null)

    let horasTrabajadas: number | null = null
    if (aperturaReal && cierreReal) {
      let diffMs = new Date(cierreReal).getTime() - new Date(aperturaReal).getTime()
      if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000 // cruce de medianoche
      horasTrabajadas = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10
    }

    let aperturaTardia = false
    if (aperturaReal && base.horaInicioEsquema) {
      let diffMin = minutosLocalArg(aperturaReal) - minutosDeHora(base.horaInicioEsquema)
      if (diffMin < -120) diffMin += 1440
      aperturaTardia = diffMin > GRACIA_APERTURA_MIN
    }

    const tipoTarifa: TipoTarifa = feriado
      ? (feriado.tipo === 'nacional' ? 'feriado_nacional' : 'feriado_puente')
      : base.turno

    // 'diurno' funciona como precio general/de fallback en la UI ("Precio
    // general por turno"): si nocturno o feriado no tienen tarifa propia
    // cargada, usan la misma tarifa que un turno diurno en vez de quedar
    // sin monto.
    let montoEstimado: number | null = null
    if (hayTarifas) {
      const override = tarifaVigenteEn(tarifaOverrideHist.get(tId), base.fecha)
      const especifica = tarifaVigenteEn(tarifaBaseHist.get(tipoTarifa), base.fecha)
      const general = tarifaVigenteEn(tarifaBaseHist.get('diurno'), base.fecha)
      montoEstimado = override ?? especifica ?? general ?? null
    }

    const cierreAnticipado = !!base.motivoCierreAnticipado
    const rondaIncompleta = rondas !== null && rondas.completas < rondas.total
    const esExcepcion = cierreAnticipado || cierreForzado || aperturaTardia || rondaIncompleta

    const turnoTrabajado: TurnoTrabajado = {
      turnoId: base.id,
      fecha: base.fecha,
      turno: base.turno,
      rol,
      clienteNombre: base.clienteNombre,
      aperturaReal: aperturaReal ?? '',
      cierreReal,
      horasTrabajadas,
      feriado,
      cierreAnticipado,
      motivoCierreAnticipado: base.motivoCierreAnticipado,
      cierreForzado,
      rondas,
      aperturaTardia,
      excepcion: esExcepcion,
      montoEstimado,
    }

    const nombre = nombresPorTecnico.get(tId)
    let resumen = resumenPorTecnico.get(tId)
    if (!resumen) {
      resumen = {
        tecnicoId: tId,
        nombre: nombre?.nombre ?? 'Desconocido',
        apellido: nombre?.apellido ?? '',
        totalTurnos: 0,
        turnosDiurnos: 0,
        turnosNocturnos: 0,
        turnosFeriadoNacional: 0,
        turnosFeriadoPuente: 0,
        horasTotales: 0,
        excepciones: 0,
        montoTotalEstimado: null,
        tarifaIncompleta: false,
        detalle: [],
      }
      resumenPorTecnico.set(tId, resumen)
    }

    resumen.totalTurnos++
    if (base.turno === 'diurno') resumen.turnosDiurnos++
    else resumen.turnosNocturnos++
    if (feriado?.tipo === 'nacional') resumen.turnosFeriadoNacional++
    if (feriado?.tipo === 'puente') resumen.turnosFeriadoPuente++
    if (horasTrabajadas !== null) resumen.horasTotales = Math.round((resumen.horasTotales + horasTrabajadas) * 10) / 10
    if (esExcepcion) resumen.excepciones++
    if (montoEstimado !== null) {
      resumen.montoTotalEstimado = (resumen.montoTotalEstimado ?? 0) + montoEstimado
    } else if (hayTarifas) {
      resumen.tarifaIncompleta = true
    }
    resumen.detalle.push(turnoTrabajado)
  }

  return Array.from(resumenPorTecnico.values()).sort((a, b) => a.apellido.localeCompare(b.apellido))
}
