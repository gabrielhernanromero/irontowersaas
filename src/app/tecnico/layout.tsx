import { requireRole } from '@/lib/auth/requireRole'
import { getSession } from '@/lib/auth/getSession'
import { supabaseAdmin } from '@/lib/supabase/admin'
import RondaAlertBanner from '@/components/tecnico/RondaAlertBanner'
import PushNotificationSetup from '@/components/PushNotificationSetup'
import OfflineBanner from '@/components/OfflineBanner'
import NavRealtime from './NavRealtime'

export default async function TecnicoLayout({ children }: { children: React.ReactNode }) {
  await requireRole('tecnico', 'admin')
  const { user } = await getSession()

  // Conteos iniciales — el cliente los mantiene en tiempo real con Supabase Realtime
  let guardiaCount  = 0
  let rondasCount   = 0
  let elementosCount = 0

  if (user) {
    const [alertasData, perfilData] = await Promise.all([
      supabaseAdmin()
        .from('alertas')
        .select('tipo')
        .eq('destinatario_id', user.id)
        .eq('leida', false),
      supabaseAdmin()
        .from('users')
        .select('cliente_id')
        .eq('id', user.id)
        .single(),
    ])

    const alertas = alertasData.data ?? []
    const rondasTipos = new Set(['ronda_proxima', 'ronda_vencida'])
    guardiaCount  = alertas.filter(a => !rondasTipos.has(a.tipo)).length
    rondasCount   = alertas.filter(a =>  rondasTipos.has(a.tipo)).length

    const clienteId = perfilData.data?.cliente_id
    if (clienteId) {
      const { count } = await supabaseAdmin()
        .from('elementos_puesto')
        .select('id', { count: 'exact', head: true })
        .eq('cliente_id', clienteId)
        .eq('estado_admin', 'en_mantenimiento')
      elementosCount = count ?? 0
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <OfflineBanner />
      <PushNotificationSetup />
      {user && <RondaAlertBanner tecnicoId={user.id} />}

      <main className="max-w-[430px] mx-auto pb-20 px-4 pt-4">{children}</main>

      {user && (
        <NavRealtime
          userId={user.id}
          initialGuardia={guardiaCount}
          initialRondas={rondasCount}
          initialElementos={elementosCount}
        />
      )}
    </div>
  )
}
