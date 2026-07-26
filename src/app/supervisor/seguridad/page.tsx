import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { History } from 'lucide-react'
import type { AuthEvent } from '@/types/database'
import SeguridadClient from './SeguridadClient'

export const dynamic = 'force-dynamic'

export default async function SeguridadPage() {
  await requireRole('supervisor', 'admin')

  const { data } = await supabaseAdmin()
    .from('auth_events')
    .select('id, user_id, email, evento, actor_id, ip, user_agent, created_at, usuario:user_id (nombre, apellido), actor:actor_id (nombre, apellido)')
    .order('created_at', { ascending: false })
    .limit(100)

  const eventos = (data ?? []) as unknown as AuthEvent[]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <History size={22} className="text-brand-ink" />
        <div>
          <h1 className="text-2xl font-condensed font-bold text-brand-ink">Seguridad</h1>
          <p className="text-sm text-gray-500">Últimos {eventos.length} eventos de acceso</p>
        </div>
      </div>

      <SeguridadClient eventos={eventos} />
    </div>
  )
}
