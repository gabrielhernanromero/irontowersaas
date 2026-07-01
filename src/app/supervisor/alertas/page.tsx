import { supabaseServer } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/getSession'
import AlertasClient from './AlertasClient'

export default async function AlertasPage() {
  const { user } = await getSession()

  const { data: alertas } = await supabaseServer()
    .from('alertas')
    .select('id, tipo, mensaje, leida, destinatario_id, planilla_id, turno_id, novedad_id, resuelta, resuelta_en, resolucion_observacion, resuelta_por, created_at')
    .eq('destinatario_id', user!.id)
    .order('resuelta', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div>
      <h1 className="text-2xl font-condensed font-bold text-brand-ink mb-6">Alertas</h1>
      <AlertasClient initialAlertas={alertas ?? []} />
    </div>
  )
}
