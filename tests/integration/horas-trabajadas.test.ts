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
      .from('tarifas_turno').insert({ tecnico_id: TECNICO_B.id, tipo: 'diurno', valor: 1500 }).select('id').single()
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

  test('detecta feriado nacional y usa esa tarifa en vez de diurno/nocturno', () => {
    const b = resumen.find((r) => r.tecnicoId === TECNICO_B.id)!
    const turnoFeriado = b.detalle.find((d) => d.fecha === FECHA_FERIADO)
    assert(!!turnoFeriado, 'debe existir el turno en fecha feriada')
    assert(turnoFeriado!.feriado?.tipo === 'nacional', 'debe traer el tipo de feriado correcto')
    // No hay tarifa cargada para feriado_nacional en este test → monto null
    assert(turnoFeriado!.montoEstimado === null, 'sin tarifa de feriado_nacional cargada, el monto debe ser null')
  })

  test('el override de técnico tiene prioridad sobre la tarifa base', () => {
    const b = resumen.find((r) => r.tecnicoId === TECNICO_B.id)!
    const turnoForzado = b.detalle.find((d) => d.cierreForzado)!
    assert(turnoForzado.montoEstimado === 1500, `Técnico B tiene override de $1500 para diurno, fue ${turnoForzado.montoEstimado}`)

    const a = resumen.find((r) => r.tecnicoId === TECNICO_A.id)!
    const turno1 = a.detalle.find((d) => d.turno === 'diurno')!
    assert(turno1.montoEstimado === 1000, `Técnico A no tiene override, debe usar la base de $1000, fue ${turno1.montoEstimado}`)
  })

  test('tarifaIncompleta queda true cuando algún turno no tiene tarifa aplicable', () => {
    const a = resumen.find((r) => r.tecnicoId === TECNICO_A.id)!
    // El turno nocturno de A no tiene tarifa de tipo 'nocturno' cargada
    assert(a.tarifaIncompleta === true, 'debe marcar tarifa incompleta cuando falta la tarifa de algún tipo')
  })
})
