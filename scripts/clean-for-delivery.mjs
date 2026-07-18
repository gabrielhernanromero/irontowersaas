/**
 * clean-for-delivery.mjs
 * Borra TODOS los datos y usuarios, y crea los dos supervisores para la entrega.
 * Uso: node scripts/clean-for-delivery.mjs
 */

import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const sb = createClient(URL, KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const SUPERVISORES = [
  { email: 'nahuelgonzalez@gmail.com', password: '123456789', nombre: 'Nahuel',  apellido: 'González' },
  { email: 'marloq952@gmail.com',      password: '123456789', nombre: 'Mariano', apellido: '' },
]

async function borrar(table, col = 'id') {
  const { error } = await sb.from(table).delete().not(col, 'is', null)
  if (error && error.code !== 'PGRST116') console.warn(`  ⚠  ${table}: ${error.message.slice(0, 80)}`)
  else console.log(`  ✓  ${table}`)
}

async function main() {
  console.log('\n🔴  LIMPIEZA PARA ENTREGA\n')

  // ── 1. Datos operativos (orden FK correcto) ──────────────────────────────────
  console.log('🗑  Borrando datos operativos…')
  await borrar('ronda_scans')
  await borrar('rondas')
  await borrar('participaciones_turno')
  await borrar('control_inventario_turno')
  await borrar('libro_novedad')
  await borrar('incidencias')
  await borrar('alertas')           // antes que libro_turno
  await borrar('push_subscriptions')
  await borrar('libro_turno')
  await borrar('libro_guardia')
  await borrar('asignaciones_turno')
  await borrar('asignaciones_persistentes')
  await borrar('planilla_extintores')
  await borrar('planilla_hidrantes')
  await borrar('planillas')
  await borrar('esquemas_cobertura')
  await borrar('puntos_control')
  await borrar('informes')
  await borrar('elementos_puesto')

  // ── 2. Usuarios ─────────────────────────────────────────────────────────────
  console.log('\n🗑  Eliminando todos los usuarios…')
  const { data: todosUsuarios } = await sb.from('users').select('id, email')

  for (const u of (todosUsuarios ?? [])) {
    await sb.from('users').delete().eq('id', u.id)
    const { error } = await sb.auth.admin.deleteUser(u.id)
    if (error) console.warn(`  ⚠  ${u.email}: ${error.message}`)
    else       console.log(`  ✓  ${u.email}`)
  }

  // ── 3. Clientes ─────────────────────────────────────────────────────────────
  console.log('\n🗑  Borrando clientes…')
  await borrar('clientes')

  // ── 4. Crear supervisores ────────────────────────────────────────────────────
  console.log('\n👤  Creando supervisores…')

  for (const sup of SUPERVISORES) {
    const { data: auth, error: eAuth } = await sb.auth.admin.createUser({
      email:         sup.email,
      password:      sup.password,
      email_confirm: true,
      user_metadata: { rol: 'supervisor', nombre: sup.nombre, apellido: sup.apellido },
    })
    if (eAuth) { console.warn(`  ⚠  auth ${sup.email}: ${eAuth.message}`); continue }

    const { error: eUser } = await sb.from('users').insert({
      id:       auth.user.id,
      email:    sup.email,
      nombre:   sup.nombre,
      apellido: sup.apellido,
      rol:      'supervisor',
      activo:   true,
    })
    if (eUser) console.warn(`  ⚠  users ${sup.email}: ${eUser.message}`)
    else       console.log(`  ✅ ${sup.nombre} ${sup.apellido} — ${sup.email}`)
  }

  // ── 5. Resumen ───────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(50))
  console.log('✅  LIMPIEZA COMPLETA\n')
  console.log('SUPERVISORES CREADOS:')
  for (const s of SUPERVISORES) {
    console.log(`  ${s.email}  /  ${s.password}`)
  }
  console.log('═'.repeat(50) + '\n')
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
