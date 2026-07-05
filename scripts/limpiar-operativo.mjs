/**
 * limpiar-operativo.mjs
 * Borra SOLO los datos operativos del turno: novedades, incidencias, turnos,
 * rondas, planillas y alertas. Deja intactos: usuarios, clientes,
 * esquemas, asignaciones, elementos y puntos de control.
 *
 * Uso: node scripts/limpiar-operativo.mjs
 */

import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!URL || !KEY) {
  console.error('Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const sb = createClient(URL, KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function del(table, filter = null) {
  let q = sb.from(table).delete()
  q = filter ? q.filter(...filter) : q.gte('created_at', '2000-01-01')
  const { error } = await q
  if (error && error.code !== 'PGRST116') {
    console.warn(`  ⚠  ${table}: ${error.message.slice(0, 80)}`)
  } else {
    console.log(`  ✓  ${table}`)
  }
}

async function main() {
  console.log('\n🧹  LIMPIEZA OPERATIVA — Iron Tower\n')
  console.log('Tablas que se borran (en orden FK):')

  await del('ronda_scans')
  await del('rondas')
  // participaciones_turno no tiene created_at — usar filtro por id
  await del('participaciones_turno', ['id', 'neq', '00000000-0000-0000-0000-000000000000'])
  await del('control_inventario_turno')
  await del('planilla_hidrantes', ['id', 'neq', '00000000-0000-0000-0000-000000000000'])
  await del('planilla_extintores', ['id', 'neq', '00000000-0000-0000-0000-000000000000'])
  await del('alertas')      // antes que planillas, libro_novedad y libro_turno (FK)
  await del('incidencias')
  await del('libro_novedad') // antes que planillas (FK planilla_id)
  await del('planillas', ['id', 'neq', '00000000-0000-0000-0000-000000000000'])
  await del('libro_turno')
  await del('informes')

  console.log('\n✅  Listo. Esquemas, asignaciones, usuarios y elementos intactos.\n')
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
