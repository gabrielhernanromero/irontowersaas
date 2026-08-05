export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase/admin'
import HorasTrabajadasClient from './HorasTrabajadasClient'

export default async function HorasTrabajadasPage() {
  const { data: tecnicos } = await supabaseAdmin()
    .from('users')
    .select('id, nombre, apellido')
    .eq('rol', 'tecnico')
    .order('apellido', { ascending: true })

  return <HorasTrabajadasClient tecnicos={tecnicos ?? []} />
}
