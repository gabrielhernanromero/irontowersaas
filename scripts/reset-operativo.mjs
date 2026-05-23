/**
 * Borra todos los datos operativos (turnos, novedades, incidencias, planillas, alertas)
 * preservando: users, clientes, elementos_puesto
 */

import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const tablas = [
  'libro_novedad',
  'incidencias',
  'libro_turno',
  'alertas',
  'planilla_hidrantes',
  'planilla_extintores',
  'planillas',
]

for (const tabla of tablas) {
  const { error, count } = await sb
    .from(tabla)
    .delete({ count: 'exact' })
    .neq('id', '00000000-0000-0000-0000-000000000000') // condición siempre verdadera para borrar todo

  if (error) {
    console.error(`❌ Error borrando ${tabla}:`, error.message)
  } else {
    console.log(`✅ ${tabla}: ${count ?? '?'} filas eliminadas`)
  }
}

console.log('\nListo. users, clientes y elementos_puesto intactos.')
