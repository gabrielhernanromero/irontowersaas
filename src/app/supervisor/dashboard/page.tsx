import { supabaseServer } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/getSession'
import DashboardClient from '@/components/dashboard/DashboardClient'

export default async function DashboardPage() {
  const { user } = await getSession()
  const sb = supabaseServer()

  const [{ data: planillas }, { data: alertas }] = await Promise.all([
    sb
      .from('planillas')
      .select('id, tipo, fecha, turno, tecnico_id, cliente_id, enviada_at, inmutable, user_agent, firma_url, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
    sb
      .from('alertas')
      .select('*')
      .eq('destinatario_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  return (
    <div>
      <h1 className="text-2xl font-condensed font-bold text-brand-ink mb-6">Dashboard</h1>
      <DashboardClient
        initialPlanillas={planillas ?? []}
        initialAlertas={alertas ?? []}
      />
    </div>
  )
}
