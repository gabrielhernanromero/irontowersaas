export const dynamic = 'force-dynamic'

import { requireRole } from '@/lib/auth/requireRole'
import { getSession } from '@/lib/auth/getSession'
import { supabaseAdmin } from '@/lib/supabase/admin'
import RondaIniciarClient from './RondaIniciarClient'

export default async function RondaPage() {
  await requireRole('tecnico', 'admin')
  const { user } = await getSession()

  // Turno activo del técnico
  const { data: turno } = await supabaseAdmin()
    .from('libro_turno')
    .select('id, estado, cliente_id, clientes(id, nombre_empresa)')
    .eq('tecnico_id', user!.id)
    .in('estado', ['abierto', 'pendiente_relevo'])
    .order('horario_inicio', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Ronda activa si la hay
  const { data: rondaActiva } = await supabaseAdmin()
    .from('rondas')
    .select('id, numero_ronda, hora_inicio, total_puntos, puntos_escaneados, completa, cliente_id, clientes(id, nombre_empresa)')
    .eq('tecnico_id', user!.id)
    .is('hora_fin', null)
    .eq('completa', false)
    .order('hora_inicio', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <RondaIniciarClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      turno={(turno ?? null) as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rondaActiva={(rondaActiva ?? null) as any}
    />
  )
}
