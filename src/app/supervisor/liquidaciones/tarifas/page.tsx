export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase/admin'
import TarifasClient from './TarifasClient'
import type { TarifaRow, TecnicoRow } from './TarifasClient'

export default async function TarifasPage() {
  const [{ data: tarifas }, { data: tecnicos }] = await Promise.all([
    supabaseAdmin()
      .from('tarifas_turno')
      .select('id, tecnico_id, tipo, valor, vigente_desde, users(nombre, apellido)')
      .order('vigente_desde', { ascending: true }),
    supabaseAdmin()
      .from('users')
      .select('id, nombre, apellido, clientes(nombre_empresa)')
      .eq('rol', 'tecnico')
      .order('apellido', { ascending: true }),
  ])

  return (
    <TarifasClient
      tarifas={(tarifas ?? []) as unknown as TarifaRow[]}
      tecnicos={(tecnicos ?? []) as unknown as TecnicoRow[]}
    />
  )
}
