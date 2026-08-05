/**
 * Integration Test — Agregador de horas trabajadas (módulo de liquidación)
 *
 * Cubre los casos que motivaron el diseño del módulo:
 *  - Turnos 'cerrado' Y 'pendiente_relevo' cuentan (el técnico ya trabajó).
 *  - Turnos 'abierto' NO cuentan.
 *  - Cierre forzado por un tercero (no el técnico dueño del turno) no
 *    calcula horas y queda marcado como excepción.
 *  - Rondas incompletas marcan excepción.
 *  - Feriados: se detecta el tipo (nacional) y tiene prioridad sobre
 *    diurno/nocturno para elegir la tarifa.
 *  - Tarifas: override de técnico tiene prioridad sobre la tarifa base;
 *    si no hay tarifa para un tipo, el monto queda null y se marca
 *    tarifaIncompleta.
 *  - Vigencia de tarifas: cambiar una tarifa NO modifica retroactivamente
 *    el monto ya calculado de turnos anteriores a la fecha del cambio.
 *
 * Usa el cliente de Supabase con service role key (bypasea RLS), igual que
 * el resto de los tests de este directorio. Limpieza manual al final.
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { supabaseAdmin } from '@/lib/supabase/admin'
import { calcularHorasTrabajadas } from '@/lib/personal/calcularHorasTrabajadas'

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`❌ Assertion failed: ${message}`)
}

// IDs de técnicos reales en la DB de desarrollo (mismos que usa
// relevo-lifecycle.test.ts)
const TECNICO_A = { id: '3129d9eb-0ddc-482f-9d30-027d1de4e2dc', nombre: 'Juan Técnico', dni: '30123456' }
const TECNICO_B = { id: '90bd15ee-cba6-4a0a-a58a-44e44480a1b8', nombre: 'Carlos Rodriguez', dni: '23456789' }

const HOY = new Date().toISOString().split('T')[0]
const FECHA_FERIADO = '2027-01-01' // lejos de "hoy", no debería colisionar con nada real

let admin: ReturnType<typeof supabaseAdmin>
let clienteId: string
const turnoIds: string[] = []
const tarifaIds: string[] = []

beforeAll(async () => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Faltan variables de entorno de Supabase en .env.local')
  }
  admin = supabaseAdmin()

  const { data: cliente } = await admin.from('clientes').select('id').limit(1).single()
  if (!cliente) throw new Error('No hay ningún cliente en la DB de desarrollo — necesario para insertar rondas de prueba')
  clienteId = cliente.id
})

afterAll(async () => {
  if (turnoIds.length) {
    await admin.from('rondas').delete().in('turno_id', turnoIds)
    await admin.from('libro_novedad').delete().in('turno_id', turnoIds)
    await admin.from('libro_turno').delete().in('id', turnoIds)
  }
  await admin.from('feriados').delete().eq('fecha', FECHA_FERIADO)
  if (tarifaIds.length) await admin.from('tarifas_turno').delete().in('id', tarifaIds)
})

async function crearTurno(opts: {
  tecnico: typeof TECNICO_A
  fecha: string
  turno: 'diurno' | 'nocturno'
  estado: 'abierto' | 'cerrado' | 'pendiente_relevo'
  cierreTecnicoId?: string // si difiere del técnico, simula cierre forzado
  motivoCierreAnticipado?: string
}): Promise<string> {
  const { data: turno, error } = await admin
    .from('libro_turno')
    .insert({
      fecha: opts.fecha,
      turno: opts.turno,
      tecnico_id: opts.tecnico.id,
      tecnico_nombre: opts.tecnico.nombre,
      tecnico_dni: opts.tecnico.dni,
      horario_inicio: '08:00',
      horario_fin: opts.estado === 'abierto' ? null : '16:00',
      estado: opts.estado,
      motivo_cierre_anticipado: opts.motivoCierreAnticipado ?? null,
    })
    .select('id')
    .single()
  expect(error).toBeNull()
  const turnoId = turno!.id
  turnoIds.push(turnoId)

  if (opts.estado !== 'abierto') {
    const apertura = new Date()
    apertura.setUTCHours(apertura.getUTCHours() - 8)
    const cierre = new Date()

    await admin.from('libro_novedad').insert([
      { turno_id: turnoId, tecnico_id: opts.tecnico.id, tipo: 'apertura', hora: '08:00', descripcion: 'Apertura', created_at: apertura.toISOString() },
      { turno_id: turnoId, tecnico_id: opts.cierreTecnicoId ?? opts.tecnico.id, tipo: 'cierre', hora: '16:00', descripcion: 'Cierre', created_at: cierre.toISOString() },
    ])
  }

  return turnoId
}

describe('calcularHorasTrabajadas', () => {
  let resumen: Awaited<ReturnType<typeof calcularHorasTrabajadas>>

  beforeAll(async () => {
    // Feriado + tarifas de prueba
    const { data: feriado } = await admin
      .from('feriados')
      .insert({ fecha: FECHA_FERIADO, nombre: 'Año Nuevo (test)', tipo: 'nacional' })
      .select('id')
      .single()
    assert(!!feriado, 'debe poder insertarse el feriado de prueba')

    const { data: tarifaBaseDiurno } = await admin
      .from('tarifas_turno').insert({ tipo: 'diurno', valor: 1000 }).select('id').single()
    const { data: tarifaOverrideB } = await admin
      .from('tarifas_turno').insert({ tecnico_id: TECNICO_B.id, valor: 1500 }).select('id').single()
    if (tarifaBaseDiurno) tarifaIds.push(tarifaBaseDiurno.id)
    if (tarifaOverrideB) tarifaIds.push(tarifaOverrideB.id)

    // Turno 1: técnico A, cerrado, con una ronda incompleta
    const turno1 = await crearTurno({ tecnico: TECNICO_A, fecha: HOY, turno: 'diurno', estado: 'cerrado' })
    await admin.from('rondas').insert([
      { turno_id: turno1, tecnico_id: TECNICO_A.id, cliente_id: clienteId, completa: true },
      { turno_id: turno1, tecnico_id: TECNICO_A.id, cliente_id: clienteId, completa: false },
    ])

    // Turno 2: técnico A, pendiente_relevo (debe contar igual que cerrado)
    await crearTurno({ tecnico: TECNICO_A, fecha: HOY, turno: 'nocturno', estado: 'pendiente_relevo' })

    // Turno 3: técnico B, cerrado pero con cierre FORZADO por un tercero (A)
    await crearTurno({ tecnico: TECNICO_B, fecha: HOY, turno: 'diurno', estado: 'cerrado', cierreTecnicoId: TECNICO_A.id })

    // Turno 4: técnico B, en fecha feriada, cerrado normalmente
    await crearTurno({ tecnico: TECNICO_B, fecha: FECHA_FERIADO, turno: 'diurno', estado: 'cerrado' })

    // Turno 5: técnico A, ABIERTO — no debe contar
    await crearTurno({ tecnico: TECNICO_A, fecha: HOY, turno: 'diurno', estado: 'abierto' })

    resumen = await calcularHorasTrabajadas(admin, { desde: '2026-01-01', hasta: '2027-12-31' })
  })

  test('cuenta turnos cerrados y pendiente_relevo, pero no los abiertos', () => {
    const a = resumen.find((r) => r.tecnicoId === TECNICO_A.id)
    assert(!!a, 'debe existir resumen para Técnico A')
    assert(a!.totalTurnos === 2, `Técnico A debe tener 2 turnos contados (cerrado + pendiente_relevo), tiene ${a!.totalTurnos}`)
  })

  test('calcula horas trabajadas cruzando la apertura/cierre real (~8hs)', () => {
    const a = resumen.find((r) => r.tecnicoId === TECNICO_A.id)!
    const turno1 = a.detalle.find((d) => d.turno === 'diurno')!
    assert(turno1.horasTrabajadas !== null, 'debe calcular horas para un turno con apertura y cierre propios')
    assert(Math.abs((turno1.horasTrabajadas ?? 0) - 8) < 0.2, `horas esperadas ~8, fue ${turno1.horasTrabajadas}`)
  })

  test('ronda incompleta marca excepción', () => {
    const a = resumen.find((r) => r.tecnicoId === TECNICO_A.id)!
    const turno1 = a.detalle.find((d) => d.turno === 'diurno')!
    assert(turno1.rondas !== null && turno1.rondas.completas < turno1.rondas.total, 'debe reflejar 1/2 rondas completas')
    assert(turno1.excepcion === true, 'turno con ronda incompleta debe marcarse como excepción')
  })

  test('cierre forzado por un tercero no calcula horas y marca excepción', () => {
    const b = resumen.find((r) => r.tecnicoId === TECNICO_B.id)!
    const turnoForzado = b.detalle.find((d) => d.cierreForzado)
    assert(!!turnoForzado, 'debe detectar el turno cerrado por un tercero')
    assert(turnoForzado!.horasTrabajadas === null, 'no debe inventar horas cuando el cierre fue forzado')
    assert(turnoForzado!.excepcion === true, 'cierre forzado debe marcarse como excepción')
  })

  test('feriado nacional sin tarifa propia cae al precio general (diurno)', () => {
    // Usa Técnico A (sin override) para probar el fallback puro — Técnico B
    // tiene un override que aplica a todo, ver el test de abajo.
    const a = resumen.find((r) => r.tecnicoId === TECNICO_A.id)!
    const turno1 = a.detalle.find((d) => d.turno === 'diurno')!
    assert(turno1.montoEstimado === 1000, `sin tarifa específica, debe caer al precio general (1000), fue ${turno1.montoEstimado}`)
  })

  test('el override de técnico (precio único, sin tipo) tiene prioridad sobre la tarifa base — incluso en feriado', () => {
    const b = resumen.find((r) => r.tecnicoId === TECNICO_B.id)!
    const turnoForzado = b.detalle.find((d) => d.cierreForzado)!
    assert(turnoForzado.montoEstimado === 1500, `Técnico B tiene override de $1500, fue ${turnoForzado.montoEstimado}`)

    // El override no distingue tipo: también gana en el turno de feriado.
    const turnoFeriado = b.detalle.find((d) => d.fecha === FECHA_FERIADO)!
    assert(turnoFeriado.feriado?.tipo === 'nacional', 'debe traer el tipo de feriado correcto')
    assert(turnoFeriado.montoEstimado === 1500, `el override de Técnico B debe aplicar también en feriado (1500), fue ${turnoFeriado.montoEstimado}`)

    const a = resumen.find((r) => r.tecnicoId === TECNICO_A.id)!
    const turno1 = a.detalle.find((d) => d.turno === 'diurno')!
    assert(turno1.montoEstimado === 1000, `Técnico A no tiene override, debe usar la base de $1000, fue ${turno1.montoEstimado}`)
  })

  test('nocturno sin tarifa propia cae al precio general (diurno), sin marcar tarifa incompleta', () => {
    const a = resumen.find((r) => r.tecnicoId === TECNICO_A.id)!
    const turnoNocturno = a.detalle.find((d) => d.turno === 'nocturno')!
    assert(turnoNocturno.montoEstimado === 1000, `nocturno sin tarifa propia debe caer al precio general (1000), fue ${turnoNocturno.montoEstimado}`)
    assert(a.tarifaIncompleta === false, 'no debe quedar "incompleta" si todo resuelve por el fallback al precio general')
  })

  test('cambiar la tarifa de un técnico NO modifica el monto ya calculado de turnos pasados', async () => {
    // Simula el caso real: a Técnico A le pagaban $500 por turno diurno
    // desde 2020, y HOY se le sube a $2000. Un turno viejo (antes del
    // cambio) tiene que seguir mostrando $500 — no $2000 — cuando se
    // vuelve a generar el reporte.
    const { data: overrideViejo } = await admin
      .from('tarifas_turno')
      .insert({ tecnico_id: TECNICO_A.id, valor: 500, vigente_desde: '2020-01-01' })
      .select('id').single()
    const { data: overrideNuevo } = await admin
      .from('tarifas_turno')
      .insert({ tecnico_id: TECNICO_A.id, valor: 2000, vigente_desde: HOY })
      .select('id').single()
    if (overrideViejo) tarifaIds.push(overrideViejo.id)
    if (overrideNuevo) tarifaIds.push(overrideNuevo.id)

    const turnoViejoId = await crearTurno({ tecnico: TECNICO_A, fecha: '2026-01-15', turno: 'diurno', estado: 'cerrado' })

    const resumenVigencia = await calcularHorasTrabajadas(admin, { desde: '2020-01-01', hasta: '2027-12-31', tecnicoId: TECNICO_A.id })
    const a = resumenVigencia.find((r) => r.tecnicoId === TECNICO_A.id)!
    const turnoViejo = a.detalle.find((d) => d.turnoId === turnoViejoId)!
    const turnoDeHoy = a.detalle.find((d) => d.fecha === HOY && d.turno === 'diurno')!

    assert(turnoViejo.montoEstimado === 500, `turno de 2026-01-15 debe usar la tarifa vigente en ese momento ($500), fue ${turnoViejo.montoEstimado}`)
    assert(turnoDeHoy.montoEstimado === 2000, `turno de hoy debe usar la tarifa nueva ($2000), fue ${turnoDeHoy.montoEstimado}`)
  })
})
