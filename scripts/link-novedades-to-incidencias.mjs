/**
 * Vincula retroactivamente libro_novedad.incidencia_id a su incidencia correspondiente.
 * Solo procesa novedades con incidencia_id = null cuya descripción empiece por "[".
 * Matching: el titulo de la incidencia debe estar contenido al inicio de la descripción de la novedad.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl      = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey   = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.')
  process.exit(1)
}

const sb = createClient(supabaseUrl, serviceRoleKey)

async function main() {
  // 1. Buscar novedades sin incidencia_id que tengan formato de inventario
  const { data: novedades, error: novErr } = await sb
    .from('libro_novedad')
    .select('id, turno_id, descripcion, hora')
    .is('incidencia_id', null)
    .like('descripcion', '[%')

  if (novErr) { console.error('Error leyendo novedades:', novErr.message); process.exit(1) }
  if (!novedades?.length) { console.log('No hay novedades sin vincular.'); return }

  console.log(`\nNovedades sin vincular: ${novedades.length}`)

  // 2. Recolectar turno_ids únicos
  const turnoIds = [...new Set(novedades.map(n => n.turno_id))]

  // 3. Buscar incidencias en esos turnos
  const { data: incidencias, error: incErr } = await sb
    .from('incidencias')
    .select('id, titulo, turno_creacion_id')
    .in('turno_creacion_id', turnoIds)

  if (incErr) { console.error('Error leyendo incidencias:', incErr.message); process.exit(1) }

  console.log(`Incidencias en esos turnos: ${incidencias?.length ?? 0}\n`)

  // 4. Match y update
  let linked = 0
  let unmatched = 0

  for (const nov of novedades) {
    const candidatas = (incidencias ?? []).filter(i => i.turno_creacion_id === nov.turno_id)

    // El titulo de la incidencia debe aparecer al inicio de la descripcion de la novedad
    // Ej: descripcion = "[DESPERFECTO EN GUARDIA] Handy Motorola EP450 (103-MOT82): detalle..."
    //     titulo      = "[DESPERFECTO EN GUARDIA] Handy Motorola EP450"
    const match = candidatas.find(i => nov.descripcion.startsWith(i.titulo))

    if (!match) {
      // Intento más flexible: el titulo sin el código patrimonial
      // El titulo puede ser exactamente "[LABEL] Nombre" y la novedad tiene "[LABEL] Nombre (COD): ..."
      const flexMatch = candidatas.find(i => {
        const tituloWords = i.titulo.toLowerCase()
        return nov.descripcion.toLowerCase().startsWith(tituloWords)
      })

      if (!flexMatch) {
        console.log(`  ❌ Sin match: "${nov.descripcion.slice(0, 80)}"`)
        unmatched++
        continue
      }

      // Usamos el flexMatch
      const { error: updateErr } = await sb
        .from('libro_novedad')
        .update({ incidencia_id: flexMatch.id })
        .eq('id', nov.id)

      if (updateErr) {
        console.log(`  ⚠️  Error actualizando ${nov.id}: ${updateErr.message}`)
      } else {
        console.log(`  ✅ Vinculado (flex): "${nov.descripcion.slice(0, 60)}" → ${flexMatch.id}`)
        linked++
      }
      continue
    }

    const { error: updateErr } = await sb
      .from('libro_novedad')
      .update({ incidencia_id: match.id })
      .eq('id', nov.id)

    if (updateErr) {
      console.log(`  ⚠️  Error actualizando ${nov.id}: ${updateErr.message}`)
    } else {
      console.log(`  ✅ Vinculado: "${nov.descripcion.slice(0, 60)}" → ${match.id}`)
      linked++
    }
  }

  console.log(`\nResultado: ${linked} vinculadas / ${unmatched} sin match / ${novedades.length} total`)
}

main()
