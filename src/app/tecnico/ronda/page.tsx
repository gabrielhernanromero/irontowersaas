export const dynamic = 'force-dynamic'

import { requireRole } from '@/lib/auth/requireRole'
import { getSession } from '@/lib/auth/getSession'
import { supabaseAdmin } from '@/lib/supabase/admin'
import RondaIniciarClient from './RondaIniciarClient'
import RondaAlertsReader from './RondaAlertsReader'

export default async function RondaPage() {
  await requireRole('tecnico', 'admin')
  const { user } = await getSession()

  // Turno activo: primero como encargado/interino, luego como apoyo (participaciones_turno)
  const { data: turnoPropio } = await supabaseAdmin()
    .from('libro_turno')
    .select('id, estado, cliente_id, clientes(id, nombre_empresa, frecuencia_ronda_minutos)')
    .eq('tecnico_id', user!.id)
    .eq('estado', 'abierto')
    .order('horario_inicio', { ascending: false })
    .limit(1)
    .maybeSingle()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let turno: any = turnoPropio

  if (!turno) {
    const { data: participacion } = await supabaseAdmin()
      .from('participaciones_turno')
      .select('libro_turno!turno_id(id, estado, cliente_id, clientes(id, nombre_empresa, frecuencia_ronda_minutos))')
      .eq('usuario_id', user!.id)
      .maybeSingle()
    const lt = (participacion as any)?.libro_turno
    if (lt && lt.estado === 'abierto') turno = lt
  }

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

  // Mi ronda activa (para el botón "Continuar")
  const { data: rondaActiva } = await supabaseAdmin()
    .from('rondas')
    .select('id, numero_ronda, hora_inicio, total_puntos, puntos_escaneados, completa, cliente_id, clientes(id, nombre_empresa)')
    .eq('tecnico_id', user!.id)
    .is('hora_fin', null)
    .eq('completa', false)
    .order('hora_inicio', { ascending: false })
    .limit(1)
    .maybeSingle()

  // ¿Hay una ronda en curso en el turno (de otro participante)? Bloquea iniciar nueva.
  const rondaDelTurnoEnCurso = !rondaActiva && turno
    ? await supabaseAdmin()
        .from('rondas')
        .select('id')
        .eq('turno_id', turno.id)
        .is('hora_fin', null)
        .eq('completa', false)
        .maybeSingle()
        .then(r => r.data)
    : null

  return (
    <>
      <RondaAlertsReader />
      <RondaIniciarClient
        turno={(turno ?? null) as any}
        rondaActiva={(rondaActiva ?? null) as any}
        rondaEnCurso={!!rondaDelTurnoEnCurso}
        frecuenciaConfigurada={frecuenciaConfigurada}
        totalPuntosActivos={totalPuntosActivos}
      />
    </>
  )
}
