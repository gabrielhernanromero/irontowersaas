export const dynamic = 'force-dynamic'

import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import FeriadosClient from './FeriadosClient'

export default async function FeriadosPage() {
  await requireRole('supervisor', 'admin')

  const { data: feriados } = await supabaseAdmin()
    .from('feriados')
    .select('*')
    .order('fecha', { ascending: true })

  return <FeriadosClient feriados={feriados ?? []} />
}
