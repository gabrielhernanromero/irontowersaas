/**
 * cleanup-old.mjs — elimina clientes y técnicos que quedaron del reset anterior
 */
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const KEEPER_EMAILS = new Set([
  'supervisor@irontower.com',
  'martin.alvarez@irontower.com',
  'laura.benitez@irontower.com',
  'diego.castillo@irontower.com',
  'sofia.diaz@irontower.com',
  'pablo.garcia@irontower.com',
  'natalia.herrera@irontower.com',
])

const KEEPER_CLIENT = 'YPF S.A. — Torre Costanera'

async function main() {
  console.log('\n🧹  Limpieza final\n')

  // ── 1. Borrar técnicos viejos ──────────────────────────────────────────────
  const { data: users } = await sb.from('users').select('id, email, nombre, apellido')
  const viejos = (users ?? []).filter(u => !KEEPER_EMAILS.has(u.email))

  if (viejos.length === 0) {
    console.log('✅ No hay técnicos viejos')
  } else {
    console.log(`Eliminando ${viejos.length} técnico(s) viejo(s)…`)
    for (const u of viejos) {
      await sb.from('users').delete().eq('id', u.id)
      const { error } = await sb.auth.admin.deleteUser(u.id)
      if (error) console.warn(`  ⚠  auth ${u.email}: ${error.message}`)
      else       console.log(`  ✓  ${u.nombre} ${u.apellido} (${u.email})`)
    }
  }

  // ── 2. Borrar clientes viejos ──────────────────────────────────────────────
  const { data: clientes } = await sb.from('clientes').select('id, nombre_empresa')
  const viejosC = (clientes ?? []).filter(c => c.nombre_empresa !== KEEPER_CLIENT)

  if (viejosC.length === 0) {
    console.log('\n✅ No hay clientes viejos')
  } else {
    console.log(`\nEliminando ${viejosC.length} cliente(s) viejo(s)…`)
    for (const c of viejosC) {
      // Borrar planillas asociadas primero
      const { data: pls } = await sb.from('planillas').select('id').eq('cliente_id', c.id)
      for (const p of (pls ?? [])) {
        await sb.from('planilla_items').delete().eq('planilla_id', p.id)
      }
      if ((pls ?? []).length) await sb.from('planillas').delete().eq('cliente_id', c.id)

      const { error } = await sb.from('clientes').delete().eq('id', c.id)
      if (error) console.warn(`  ⚠  ${c.nombre_empresa}: ${error.message}`)
      else       console.log(`  ✓  ${c.nombre_empresa}`)
    }
  }

  // ── 3. Verificación final ──────────────────────────────────────────────────
  const [{ data: cs }, { data: us }] = await Promise.all([
    sb.from('clientes').select('nombre_empresa, activo'),
    sb.from('users').select('nombre, apellido, email, rol'),
  ])

  console.log('\n' + '═'.repeat(55))
  console.log('ESTADO FINAL\n')
  console.log('Clientes:')
  cs?.forEach(c => console.log(`  ${c.activo ? '✅' : '⚪'} ${c.nombre_empresa}`))
  console.log('\nUsuarios:')
  us?.sort((a,b) => a.rol.localeCompare(b.rol))
    .forEach(u => console.log(`  [${u.rol.padEnd(10)}] ${u.nombre} ${u.apellido}`))
  console.log('═'.repeat(55) + '\n')
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
