export const dynamic = 'force-dynamic'

import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import TarifasClient from './TarifasClient'
import type { TarifaRow, TecnicoRow } from './TarifasClient'

export default async function TarifasPage() {
  await requireRole('admin')

  const [{ data: tarifas }, { data: tecnicos }] = await Promise.all([
    supabaseAdmin()
      .from('tarifas_turno')
      .select('id, tecnico_id, tipo, valor, updated_at, users(nombre, apellido)')
      .order('tipo', { ascending: true }),
    supabaseAdmin()
      .from('users')
      .select('id, nombre, apellido')
      .eq('rol', 'tecnico')
      .order('apellido', { ascending: true }),
  ])

  return (
    <TarifasClient
      tarifas={(tarifas ?? []) as unknown as TarifaRow[]}
      tecnicos={(tecnicos ?? []) as TecnicoRow[]}
    />
  )
}
