import { supabaseServer } from '@/lib/supabase/server'
import InformesClient from './InformesClient'

export default async function InformesPage() {
  const { data: planillas } = await supabaseServer()
    .from('planillas')
    .select(`
      id, tipo, fecha, turno, inmutable, enviada_at,
      users!tecnico_id(nombre, apellido),
      clientes(nombre_empresa, contacto_email)
    `)
    .eq('inmutable', true)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div>
      <h1 className="text-2xl font-condensed font-bold text-brand-ink mb-6">Informes</h1>
      <InformesClient planillas={planillas ?? []} />
    </div>
  )
}
