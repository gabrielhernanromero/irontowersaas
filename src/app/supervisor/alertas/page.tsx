import { supabaseServer } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/getSession'
import AlertasClient from './AlertasClient'

export default async function AlertasPage() {
  const { user } = await getSession()

  const { data: alertas } = await supabaseServer()
    .from('alertas')
    .select('*')
    .eq('destinatario_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div>
      <h1 className="text-2xl font-condensed font-bold text-brand-ink mb-6">Alertas</h1>
      <AlertasClient initialAlertas={alertas ?? []} />
    </div>
  )
}
