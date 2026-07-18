/**
 * reset-demo.mjs
 * Limpia TODA la DB (excepto el supervisor) y crea 1 cliente + 6 técnicos frescos.
 * Uso: node scripts/reset-demo.mjs
 *
 * ANTES de correr este script aplicar las migraciones pendientes en Supabase:
 *   → scripts/pending-migrations.sql  (copiar y pegar en el SQL editor de Supabase)
 */

import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const sb = createClient(URL, KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const SUPERVISOR_EMAIL = 'supervisor@irontower.com'

const CLIENTE = {
  nombre_empresa:   'YPF S.A. — Torre Costanera',
  cuit:             '30-54668997-9',
  direccion:        'Macacha Güemes 515, Puerto Madero, CABA',
  contacto_nombre:  'Roberto López',
  contacto_email:   'supervisor@irontower.com',
  contacto_telefono: '011-4320-0000',
  activo:           true,
}

const TECNICOS = [
  { nombre: 'Martín',  apellido: 'Álvarez',  dni: '28111001', email: 'martin.alvarez@irontower.com',  pass: 'IronTec1!' },
  { nombre: 'Laura',   apellido: 'Benítez',  dni: '30222002', email: 'laura.benitez@irontower.com',   pass: 'IronTec2!' },
  { nombre: 'Diego',   apellido: 'Castillo', dni: '32333003', email: 'diego.castillo@irontower.com',  pass: 'IronTec3!' },
  { nombre: 'Sofía',   apellido: 'Díaz',     dni: '29444004', email: 'sofia.diaz@irontower.com',      pass: 'IronTec4!' },
  { nombre: 'Pablo',   apellido: 'García',   dni: '35555005', email: 'pablo.garcia@irontower.com',    pass: 'IronTec5!' },
  { nombre: 'Natalia', apellido: 'Herrera',  dni: '27666006', email: 'natalia.herrera@irontower.com', pass: 'IronTec6!' },
]

// ─────────────────────────────────────────────────────────────────────────────

async function del(table, condition = {}) {
  const q = sb.from(table).delete()
  // Si no hay condición, borramos todo usando un filtro que siempre es true
  const result = Object.keys(condition).length
    ? await Object.entries(condition).reduce((acc, [k, v]) => acc.eq(k, v), q)
    : await q.gte('created_at', '2000-01-01')   // borra todo

  if (result.error && result.error.code !== 'PGRST116') {
    console.warn(`  ⚠  ${table}: ${result.error.message.slice(0, 80)}`)
  } else {
    console.log(`  ✓  ${table}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🔴  RESET DEMO — Iron Tower\n')

  // ── 1. Supervisor ──────────────────────────────────────────────────────────
  const { data: sup } = await sb.from('users').select('id').eq('email', SUPERVISOR_EMAIL).single()
  if (!sup) { console.error('❌ Supervisor no encontrado. Abortando.'); process.exit(1) }
  console.log(`✅ Supervisor: ${sup.id}\n`)

  // ── 2. Datos operativos (orden FK) ─────────────────────────────────────────
  console.log('🗑  Limpiando datos operativos…')
  await del('ronda_scans')
  await del('rondas')
  await del('participaciones_turno')
  await del('libro_novedad')
  await del('incidencias')
  await del('libro_turno')
  await del('asignaciones_turno')
  await del('asignaciones_persistentes')
  await del('esquemas_cobertura')
  await del('puntos_control')
  await del('alertas')
  await del('informes')
  await del('elementos_puesto')

  // planillas tiene FK desde planilla_items
  await del('planilla_items')
  await del('planillas')

  // ── 3. Técnicos no-supervisor ──────────────────────────────────────────────
  console.log('\n🗑  Eliminando técnicos…')
  const { data: old } = await sb.from('users').select('id, email').neq('id', sup.id)

  for (const u of (old ?? [])) {
    await sb.from('users').delete().eq('id', u.id)
    const { error } = await sb.auth.admin.deleteUser(u.id)
    if (error) console.warn(`  ⚠  auth ${u.email}: ${error.message}`)
    else       console.log(`  ✓  ${u.email}`)
  }

  // ── 4. Clientes ────────────────────────────────────────────────────────────
  console.log('\n🗑  Eliminando clientes…')
  await del('clientes')

  // ── 5. Nuevo cliente ───────────────────────────────────────────────────────
  console.log('\n🏢  Creando cliente…')
  const { data: cli, error: errCli } = await sb.from('clientes').insert(CLIENTE).select().single()
  if (errCli) { console.error('❌ Cliente:', errCli.message); process.exit(1) }
  console.log(`  ✅ ${cli.nombre_empresa} (${cli.id})`)

  // ── 6. Técnicos ────────────────────────────────────────────────────────────
  console.log('\n👷  Creando técnicos…')
  const creados = []

  for (const tec of TECNICOS) {
    const { data: auth, error: eAuth } = await sb.auth.admin.createUser({
      email:          tec.email,
      password:       tec.pass,
      email_confirm:  true,
      user_metadata:  { rol: 'tecnico', nombre: tec.nombre, apellido: tec.apellido },
    })
    if (eAuth) { console.warn(`  ⚠  auth ${tec.email}: ${eAuth.message}`); continue }

    const { error: eUser } = await sb.from('users').upsert({
      id:             auth.user.id,
      email:          tec.email,
      nombre:         tec.nombre,
      apellido:       tec.apellido,
      dni:            tec.dni,
      rol:            'tecnico',
      cliente_id:     cli.id,
      turno_habitual: 'diurno',
      activo:         true,
    })
    if (eUser) console.warn(`  ⚠  users ${tec.email}: ${eUser.message}`)
    else       console.log(`  ✅ ${tec.nombre} ${tec.apellido}`)

    creados.push(tec)
  }

  // ── 7. Resumen ─────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60))
  console.log('✅  RESET COMPLETO\n')
  console.log('SUPERVISOR')
  console.log('  supervisor@irontower.com  /  super123\n')
  console.log('CLIENTE')
  console.log(`  ${CLIENTE.nombre_empresa}`)
  console.log(`  ${CLIENTE.direccion}\n`)
  console.log('TÉCNICOS')
  for (const t of creados) {
    console.log(`  ${(t.nombre + ' ' + t.apellido).padEnd(20)}  ${t.email.padEnd(38)}  ${t.pass}`)
  }
  console.log('═'.repeat(60) + '\n')
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
