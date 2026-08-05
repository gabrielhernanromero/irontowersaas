export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase/admin'
import HorasTrabajadasClient from './HorasTrabajadasClient'

export default async function HorasTrabajadasPage() {
  const [{ data: tecnicos }, { data: clientes }] = await Promise.all([
    supabaseAdmin()
      .from('users')
      .select('id, nombre, apellido')
      .eq('rol', 'tecnico')
      .order('apellido', { ascending: true }),
    supabaseAdmin()
      .from('clientes')
      .select('id, nombre_empresa')
      .order('nombre_empresa', { ascending: true }),
  ])

  return <HorasTrabajadasClient tecnicos={tecnicos ?? []} clientes={clientes ?? []} />
}
