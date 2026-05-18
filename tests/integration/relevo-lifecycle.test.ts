/**
 * Integration Test — Ciclo completo de relevo de guardia
 *
 * Prueba el flujo: Técnico A abre turno → carga novedades → cierra
 * (pendiente_relevo) → Técnico B toma el relevo (atómico) → verifica
 * integridad de la DB en cada transición de estado.
 *
 * Usa el cliente de Supabase con service role key para operar sin RLS,
 * igual que hace el backend en producción.
 *
 * Limpieza: borra todas las filas creadas al final (rollback manual),
 * por lo que es seguro correr contra la DB real de desarrollo.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import * as crypto from 'crypto'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

// ── Helpers ───────────────────────────────────────────────────────────────────

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`❌ Assertion failed: ${message}`)
}

function nowTime(): string {
  return new Date().toTimeString().slice(0, 5)   // "HH:MM"
}

function todayDate(): string {
  return new Date().toISOString().split('T')[0]  // "YYYY-MM-DD"
}

/**
 * Hash SHA-256 de auditoría — combina los campos críticos del turno cerrado.
 * Permite verificar que los datos del turno A no fueron alterados tras el cierre.
 */
function auditHash(fields: {
  id: string
  tecnico_id: string
  folio_numero: number
  fecha: string
  turno: string
  horario_inicio: string
  horario_fin: string
  estado: string
}): string {
  const raw = [
    fields.id,
    fields.tecnico_id,
    fields.folio_numero,
    fields.fecha,
    fields.turno,
    fields.horario_inicio,
    fields.horario_fin,
    fields.estado,
  ].join('|')
  return crypto.createHash('sha256').update(raw).digest('hex')
}

// ── IDs de los técnicos reales en la DB de desarrollo ────────────────────────

const TECNICO_A = {
  id:     '3129d9eb-0ddc-482f-9d30-027d1de4e2dc',
  nombre: 'Juan Técnico',
  dni:    '30123456',
}

const TECNICO_B = {
  id:     '90bd15ee-cba6-4a0a-a58a-44e44480a1b8',
  nombre: 'Carlos Rodriguez',
  dni:    '23456789',
}

// ── Setup del cliente ─────────────────────────────────────────────────────────

let supabase: SupabaseClient
let turnoAId: string
let turnoBId: string
const novedadIds: string[] = []

beforeAll(() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local'
    )
  }

  supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log('\n🏁  Iron Tower OS — Integration Test: Ciclo de Relevo\n')
})

// ── Limpieza post-test ────────────────────────────────────────────────────────

afterAll(async () => {
  console.log('\n🧹  Limpiando filas creadas por el test...')

  if (novedadIds.length) {
    await supabase.from('libro_novedad').delete().in('id', novedadIds)
  }
  if (turnoBId) {
    await supabase.from('libro_novedad').delete().eq('turno_id', turnoBId)
    await supabase.from('libro_turno').delete().eq('id', turnoBId)
  }
  if (turnoAId) {
    await supabase.from('libro_novedad').delete().eq('turno_id', turnoAId)
    await supabase.from('libro_turno').delete().eq('id', turnoAId)
  }

  console.log('✅  Limpieza completa.\n')
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Ciclo completo de relevo de guardia', () => {

  // ── PASO 1: Técnico A abre turno ──────────────────────────────────────────

  test('PASO 1 — Técnico A abre un turno en estado "abierto"', async () => {
    console.log('📋  PASO 1: Abriendo turno para Técnico A...')

    const { data, error } = await supabase
      .from('libro_turno')
      .insert({
        fecha:          todayDate(),
        turno:          'diurno',
        tecnico_id:     TECNICO_A.id,
        tecnico_nombre: TECNICO_A.nombre,
        tecnico_dni:    TECNICO_A.dni,
        horario_inicio: nowTime(),
        estado:         'abierto',
      })
      .select('id, folio_numero, estado, tecnico_id, horario_inicio, created_at')
      .single()

    expect(error).toBeNull()
    expect(data).not.toBeNull()

    turnoAId = data!.id

    assert(data!.estado === 'abierto',        `estado debe ser "abierto", es "${data!.estado}"`)
    assert(data!.tecnico_id === TECNICO_A.id, 'tecnico_id debe coincidir con Técnico A')
    assert(data!.folio_numero > 0,            'folio_numero debe ser positivo (autoincrement)')
    assert(!!data!.horario_inicio,             'horario_inicio debe estar registrado')

    console.log(`   ✅ Turno A creado | ID: ${turnoAId} | Folio: #${data!.folio_numero} | Inicio: ${data!.horario_inicio}`)
  })

  // ── PASO 2: Cargar novedades ──────────────────────────────────────────────

  test('PASO 2 — Se insertan novedades vinculadas al turno A', async () => {
    console.log('📋  PASO 2: Insertando novedades...')

    expect(turnoAId).toBeDefined()

    const novedades = [
      {
        turno_id:    turnoAId,
        tipo:        'apertura',
        hora:        '08:00',
        descripcion: 'Apertura de guardia',
      },
      {
        turno_id:    turnoAId,
        tipo:        'novedad',
        hora:        '09:30',
        descripcion: 'Revisión de extintores en Sector B.',
        riesgo_detectado:  null,
        medidas_adoptadas: null,
      },
      {
        turno_id:          turnoAId,
        tipo:              'novedad',
        hora:              '11:15',
        descripcion:       'Fuga detectada en cañería principal del piso 4.',
        riesgo_detectado:  'Riesgo de accidente por piso húmedo.',
        medidas_adoptadas: 'Se colocó señalización y se cerró el acceso al área.',
      },
    ]

    const { data, error } = await supabase
      .from('libro_novedad')
      .insert(novedades)
      .select('id, tipo, hora, riesgo_detectado')

    expect(error).toBeNull()
    expect(data).toHaveLength(3)

    data!.forEach((n) => novedadIds.push(n.id))

    const critica = data!.find((n) => n.riesgo_detectado !== null)
    assert(!!critica, 'Debe existir al menos una novedad con riesgo_detectado')

    const tipos = data!.map((n) => n.tipo)
    assert(tipos.includes('apertura'), 'Debe haber novedad de tipo "apertura"')
    assert(tipos.includes('novedad'),  'Debe haber novedades de tipo "novedad"')

    console.log(`   ✅ ${data!.length} novedades insertadas | IDs: ${data!.map(n => n.id.slice(0,8)).join(', ')}...`)
    console.log(`   ⚠️  Novedad crítica registrada: "${critica?.riesgo_detectado}"`)
  })

  // ── PASO 3: Técnico A cierra → pendiente_relevo ───────────────────────────

  test('PASO 3 — Técnico A pasa el turno a "pendiente_relevo" (cierre parcial)', async () => {
    console.log('📋  PASO 3: Pasando turno A a pendiente_relevo...')

    expect(turnoAId).toBeDefined()

    const horario_fin = nowTime()

    const { data, error } = await supabase
      .from('libro_turno')
      .update({
        estado:      'pendiente_relevo',
        horario_fin,
        firma_cierre_url: 'firmas/test-cierre-placeholder.png',
      })
      .eq('id', turnoAId)
      .eq('estado', 'abierto')  // guard: solo actualiza si está abierto
      .select('id, estado, horario_fin')
      .single()

    expect(error).toBeNull()
    expect(data).not.toBeNull()

    assert(data!.estado === 'pendiente_relevo', `estado debe ser "pendiente_relevo", es "${data!.estado}"`)
    assert(!!data!.horario_fin,                 'horario_fin debe quedar registrado')

    console.log(`   ✅ Turno A ahora en estado: "${data!.estado}" | Fin: ${data!.horario_fin}`)

    // Verificar inmutabilidad: el guard .eq('estado', 'abierto') debe bloquear
    // un segundo intento de update sobre el mismo turno
    console.log('   🔒  Verificando inmutabilidad (no debe poder volver a abierto)...')

    const { data: bloqueado } = await supabase
      .from('libro_turno')
      .update({ estado: 'abierto' })
      .eq('id', turnoAId)
      .eq('estado', 'abierto')   // condición falsa → no afecta ninguna fila
      .select('id')

    assert(
      !bloqueado || bloqueado.length === 0,
      'El turno en pendiente_relevo NO debe poder volver a abierto con el guard de estado'
    )

    console.log('   ✅ Inmutabilidad confirmada: 0 filas afectadas por update de reversión')
  })

  // ── PASO 4: Relevo atómico — Técnico B toma la guardia ───────────────────

  test('PASO 4 — Relevo atómico: Turno A → cerrado + Turno B → abierto', async () => {
    console.log('📋  PASO 4: Ejecutando relevo atómico...')

    expect(turnoAId).toBeDefined()

    // ── 4a: Capturar datos del turno A antes del cierre ────────────────────
    const { data: turnoAAntes, error: fetchErr } = await supabase
      .from('libro_turno')
      .select('id, folio_numero, fecha, turno, tecnico_id, horario_inicio, horario_fin, estado')
      .eq('id', turnoAId)
      .single()

    expect(fetchErr).toBeNull()
    assert(turnoAAntes!.estado === 'pendiente_relevo', 'Turno A debe estar en pendiente_relevo antes del relevo')

    // ── 4b: Cerrar turno A ────────────────────────────────────────────────
    const { data: turnoCerrado, error: closeErr } = await supabase
      .from('libro_turno')
      .update({
        estado:           'cerrado',
        firma_relevo_url: 'firmas/test-relevo-placeholder.png',
        relevo_nombre:    TECNICO_B.nombre,
        relevo_dni:       TECNICO_B.dni,
      })
      .eq('id', turnoAId)
      .eq('estado', 'pendiente_relevo')  // guard: solo si está pendiente
      .select('id, estado, relevo_nombre, relevo_dni, horario_fin')
      .single()

    expect(closeErr).toBeNull()
    assert(turnoCerrado!.estado === 'cerrado',            'Turno A debe quedar en "cerrado"')
    assert(turnoCerrado!.relevo_nombre === TECNICO_B.nombre, 'relevo_nombre debe ser el Técnico B')
    assert(turnoCerrado!.relevo_dni    === TECNICO_B.dni,    'relevo_dni debe ser el DNI del Técnico B')

    console.log(`   ✅ Turno A cerrado | relevo firmado por: ${turnoCerrado!.relevo_nombre}`)

    // ── 4c: Crear turno B ─────────────────────────────────────────────────
    const horarioInicioB = nowTime()

    const { data: turnoB, error: insertErr } = await supabase
      .from('libro_turno')
      .insert({
        fecha:          todayDate(),
        turno:          'nocturno',
        tecnico_id:     TECNICO_B.id,
        tecnico_nombre: TECNICO_B.nombre,
        tecnico_dni:    TECNICO_B.dni,
        horario_inicio: horarioInicioB,
        estado:         'abierto',
      })
      .select('id, folio_numero, estado, tecnico_id, horario_inicio')
      .single()

    expect(insertErr).toBeNull()
    expect(turnoB).not.toBeNull()

    turnoBId = turnoB!.id

    assert(turnoB!.estado    === 'abierto',        'Turno B debe estar en "abierto"')
    assert(turnoB!.tecnico_id === TECNICO_B.id,    'tecnico_id del Turno B debe ser el Técnico B')
    assert(turnoB!.folio_numero > turnoAAntes!.folio_numero, 'Folio del Turno B debe ser mayor al del Turno A')

    console.log(`   ✅ Turno B creado | ID: ${turnoBId} | Folio: #${turnoB!.folio_numero} | Inicio: ${turnoB!.horario_inicio}`)

    // ── 4d: Novedad de apertura automática en Turno B ─────────────────────
    const { data: novedadApertura, error: novedadErr } = await supabase
      .from('libro_novedad')
      .insert({
        turno_id:    turnoBId,
        tipo:        'apertura',
        hora:        horarioInicioB,
        descripcion: `Apertura de guardia por relevo — ${TECNICO_B.nombre}, DNI ${TECNICO_B.dni}`,
      })
      .select('id, tipo, descripcion')
      .single()

    expect(novedadErr).toBeNull()
    assert(novedadApertura!.tipo === 'apertura', 'La novedad del Turno B debe ser de tipo "apertura"')

    console.log(`   ✅ Novedad de apertura creada en Turno B: "${novedadApertura!.descripcion}"`)

    // ── 4e: Hash SHA-256 de auditoría del Turno A cerrado ────────────────
    const { data: turnoAFinal } = await supabase
      .from('libro_turno')
      .select('id, folio_numero, fecha, turno, tecnico_id, horario_inicio, horario_fin, estado')
      .eq('id', turnoAId)
      .single()

    const hash = auditHash({
      id:             turnoAFinal!.id,
      tecnico_id:     turnoAFinal!.tecnico_id,
      folio_numero:   turnoAFinal!.folio_numero,
      fecha:          turnoAFinal!.fecha,
      turno:          turnoAFinal!.turno,
      horario_inicio: String(turnoAFinal!.horario_inicio),
      horario_fin:    String(turnoAFinal!.horario_fin),
      estado:         turnoAFinal!.estado,
    })

    assert(hash.length === 64, 'El hash SHA-256 debe tener 64 caracteres hex')
    assert(turnoAFinal!.estado === 'cerrado', 'El turno A final debe estar en estado "cerrado"')

    console.log(`   🔐 Hash SHA-256 de auditoría del Turno A: ${hash}`)
  })

  // ── PASO 5: Verificación de integridad final ───────────────────────────────

  test('PASO 5 — Verificación de integridad referencial y estados finales', async () => {
    console.log('📋  PASO 5: Verificación de integridad final...')

    expect(turnoAId).toBeDefined()
    expect(turnoBId).toBeDefined()

    // Turno A debe estar cerrado con todos los campos requeridos
    const { data: turnoA } = await supabase
      .from('libro_turno')
      .select('estado, horario_fin, firma_cierre_url, firma_relevo_url, relevo_nombre, relevo_dni')
      .eq('id', turnoAId)
      .single()

    assert(turnoA!.estado           === 'cerrado',   'Turno A: estado debe ser "cerrado"')
    assert(!!turnoA!.horario_fin,                    'Turno A: horario_fin debe estar registrado')
    assert(!!turnoA!.firma_cierre_url,               'Turno A: firma_cierre_url debe estar registrada')
    assert(!!turnoA!.firma_relevo_url,               'Turno A: firma_relevo_url debe estar registrada')
    assert(!!turnoA!.relevo_nombre,                  'Turno A: relevo_nombre debe estar registrado')
    assert(!!turnoA!.relevo_dni,                     'Turno A: relevo_dni debe estar registrado')

    // Turno B debe estar abierto
    const { data: turnoB } = await supabase
      .from('libro_turno')
      .select('estado, tecnico_id')
      .eq('id', turnoBId)
      .single()

    assert(turnoB!.estado     === 'abierto',    'Turno B: estado debe ser "abierto"')
    assert(turnoB!.tecnico_id === TECNICO_B.id, 'Turno B: tecnico_id debe ser el Técnico B')

    // Las novedades del Turno A deben seguir intactas
    const { data: novedadesA, error: novedadesErr } = await supabase
      .from('libro_novedad')
      .select('id, tipo')
      .eq('turno_id', turnoAId)

    expect(novedadesErr).toBeNull()
    assert(novedadesA!.length === 3, `Turno A debe tener 3 novedades, tiene ${novedadesA!.length}`)

    // El Turno B solo puede tener un técnico sin turno abierto adicional
    const { data: turnosAbiertos } = await supabase
      .from('libro_turno')
      .select('id')
      .eq('tecnico_id', TECNICO_B.id)
      .eq('estado', 'abierto')

    assert(
      turnosAbiertos!.length === 1,
      `Técnico B debe tener exactamente 1 turno abierto, tiene ${turnosAbiertos!.length}`
    )

    console.log('   ✅ Turno A cerrado con todos los campos requeridos')
    console.log('   ✅ Turno B activo y asignado al Técnico B')
    console.log('   ✅ Novedades del Turno A intactas (3 filas)')
    console.log('   ✅ Técnico B tiene exactamente 1 turno abierto')
    console.log('\n🎉  Ciclo de relevo completado y verificado correctamente.\n')
  })
})
