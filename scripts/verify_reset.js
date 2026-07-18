const { createClient } = require('@supabase/supabase-js')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

async function main() {
  const [{ data: clientes }, { data: users }, { data: esquemas }, { data: libros }] = await Promise.all([
    sb.from('clientes').select('id, nombre_empresa, activo'),
    sb.from('users').select('id, nombre, apellido, email, rol, activo'),
    sb.from('esquemas_cobertura').select('id'),
    sb.from('libro_turno').select('id'),
  ])
  
  console.log(`\nClientes (${clientes?.length ?? 0}):`)
  clientes?.forEach(c => console.log(`  ${c.activo ? '✅' : '⚪'} ${c.nombre_empresa}`))
  
  console.log(`\nUsuarios (${users?.length ?? 0}):`)
  users?.sort((a,b) => a.rol.localeCompare(b.rol)).forEach(u => 
    console.log(`  [${u.rol.padEnd(10)}] ${(u.nombre+' '+u.apellido).padEnd(22)} ${u.email}`)
  )
  
  console.log(`\nEsquemas de cobertura: ${esquemas?.length ?? 0}`)
  console.log(`Libro de guardia (turnos): ${libros?.length ?? 0}`)
  console.log('')
}
main()
