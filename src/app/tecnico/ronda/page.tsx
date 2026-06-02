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
    .select('id, estado, cliente_id, clientes(id, nombre_empresa, frecuencia_ronda_minutos)')
    .eq('tecnico_id', user!.id)
    .in('estado', ['abierto', 'pendiente_relevo'])
    .order('horario_inicio', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Verificar configuración de ronda para el cliente
  let frecuenciaConfigurada = false
  let totalPuntosActivos    = 0

  if (turno?.cliente_id) {
    const cliente = turno.clientes as { frecuencia_ronda_minutos: number | null } | null
    frecuenciaConfigurada = !!cliente?.frecuencia_ronda_minutos

    const { count } = await supabaseAdmin()
      .from('puntos_control')
      .select('id', { count: 'exact', head: true })
      .eq('cliente_id', turno.cliente_id)
      .eq('activo', true)
    totalPuntosActivos = count ?? 0
  }

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
      frecuenciaConfigurada={frecuenciaConfigurada}
      totalPuntosActivos={totalPuntosActivos}
    />
  )
}
