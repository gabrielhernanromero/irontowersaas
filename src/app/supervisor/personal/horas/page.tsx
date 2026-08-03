export const dynamic = 'force-dynamic'

import { requireRole } from '@/lib/auth/requireRole'
import { getSession } from '@/lib/auth/getSession'
import { supabaseAdmin } from '@/lib/supabase/admin'
import HorasTrabajadasClient from './HorasTrabajadasClient'

export default async function HorasTrabajadasPage() {
  await requireRole('supervisor', 'admin')
  const { user } = await getSession()

  const { data: tecnicos } = await supabaseAdmin()
    .from('users')
    .select('id, nombre, apellido')
    .eq('rol', 'tecnico')
    .order('apellido', { ascending: true })

  return (
    <HorasTrabajadasClient
      tecnicos={tecnicos ?? []}
      esAdmin={user?.rol === 'admin'}
    />
  )
}
