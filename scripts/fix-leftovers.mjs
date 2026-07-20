import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

const { data: clientes } = await sb.from('clientes').select('id, nombre_empresa, activo')
console.log('Clientes:')
clientes?.forEach(c => console.log(' ', c.activo ? '✅' : '⚪', c.nombre_empresa, c.id))

// Borrar inactivos
const inactivos = clientes?.filter(c => !c.activo) ?? []
for (const c of inactivos) {
  const { error } = await sb.from('clientes').delete().eq('id', c.id)
  if (error) console.warn('  ⚠', c.nombre_empresa, error.message)
  else console.log('  🗑 eliminado:', c.nombre_empresa)
}

// Ver usuarios sin auth (los viejos que quedaron en public.users sin poder borrar de auth)
const { data: users } = await sb.from('users').select('id, email, nombre, apellido, cliente_id')
console.log('\nUsuarios:')
users?.forEach(u => console.log(' ', u.cliente_id ? '✅' : '⚠ sin cliente', `${u.nombre} ${u.apellido}`, u.email))
