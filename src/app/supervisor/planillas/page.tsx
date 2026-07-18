import { supabaseServer } from '@/lib/supabase/server'
import PlanillasSupervisorClient from './PlanillasSupervisorClient'

export default async function PlanillasPage({
  searchParams,
}: {
  searchParams: { tipo?: string; fecha?: string }
}) {
  const sb = supabaseServer()

  let query = sb
    .from('planillas')
    .select(`
      id, tipo, fecha, turno, inmutable, enviada_at, created_at,
      users!tecnico_id(nombre, apellido),
      clientes(nombre_empresa)
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  if (searchParams.tipo) query = query.eq('tipo', searchParams.tipo)
  if (searchParams.fecha) query = query.eq('fecha', searchParams.fecha)

  const [{ data: planillas }, { data: clientes }] = await Promise.all([
    query,
    sb.from('clientes').select('id, nombre_empresa').eq('activo', true).order('nombre_empresa'),
  ])

  return (
    <PlanillasSupervisorClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      planillas={(planillas ?? []) as any}
      searchParams={searchParams}
      clientes={clientes ?? []}
    />
  )
}
