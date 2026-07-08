export const dynamic = 'force-dynamic'

import { requireRole } from '@/lib/auth/requireRole'
import { getSession } from '@/lib/auth/getSession'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import RondaActivaClient from './RondaActivaClient'

export default async function RondaActivaPage({ params }: { params: { id: string } }) {
  await requireRole('tecnico', 'admin')
  const { user } = await getSession()

  const { data: ronda } = await supabaseAdmin()
    .from('rondas')
    .select(`
      id, numero_ronda, hora_inicio, hora_fin,
      total_puntos, puntos_escaneados, completa, cliente_id,
      clientes(id, nombre_empresa),
      ronda_scans(id, punto_control_id, escaneado_at, foto_url)
    `)
    .eq('id', params.id)
    .eq('tecnico_id', user!.id)
    .single()

  if (!ronda) redirect('/tecnico/ronda')

  // Puntos de control del cliente
  const { data: puntos } = await supabaseAdmin()
    .from('puntos_control')
    .select('id, nombre, ubicacion, orden, codigo_qr')
    .eq('cliente_id', ronda.cliente_id)
    .eq('activo', true)
    .order('orden', { ascending: true })

  // Incidencias activas (abiertas o en seguimiento) por punto de control
  const puntosIds = (puntos ?? []).map(p => p.id)
  const { data: incidenciasAbiertas } = puntosIds.length
    ? await supabaseAdmin()
        .from('incidencias')
        .select('id, punto_control_id, titulo, descripcion, severidad, estado, created_at, users!tecnico_detector_id(nombre, apellido)')
        .in('punto_control_id', puntosIds)
        .in('estado', ['abierto', 'en_seguimiento'])
    : { data: [] }

  const incidenciasPorPunto: Record<string, { id: string; titulo: string; descripcion: string; severidad: string | null; estado: string; created_at: string; detector_nombre: string | null }[]> = {}
  for (const inc of (incidenciasAbiertas ?? []) as any[]) {
    if (!inc.punto_control_id) continue
    if (!incidenciasPorPunto[inc.punto_control_id]) incidenciasPorPunto[inc.punto_control_id] = []
    const u = inc.users
    incidenciasPorPunto[inc.punto_control_id].push({
      ...inc,
      detector_nombre: u ? `${u.nombre ?? ''} ${u.apellido ?? ''}`.trim() : null,
    })
  }

  // Historial de seguimientos por incidencia
  type HistorialEntry = { id: string; descripcion: string; hora: string | null; created_at: string; autor: string | null }
  const incidenciasIds = (incidenciasAbiertas ?? []).map(i => i.id)
  const { data: historialRows } = incidenciasIds.length
    ? await supabaseAdmin()
        .from('libro_novedad')
        .select('id, incidencia_id, descripcion, hora, created_at, users!tecnico_id(nombre, apellido)')
        .in('incidencia_id', incidenciasIds)
        .order('created_at', { ascending: true })
    : { data: [] }

  const historialPorIncidencia: Record<string, HistorialEntry[]> = {}
  for (const nov of (historialRows ?? []) as any[]) {
    if (!nov.incidencia_id) continue
    if (!historialPorIncidencia[nov.incidencia_id]) historialPorIncidencia[nov.incidencia_id] = []
    historialPorIncidencia[nov.incidencia_id].push({
      id:          nov.id,
      descripcion: nov.descripcion ?? '',
      hora:        nov.hora ?? null,
      created_at:  nov.created_at,
      autor:       nov.users ? `${nov.users.nombre ?? ''} ${nov.users.apellido ?? ''}`.trim() : null,
    })
  }

  return (
    <RondaActivaClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ronda={ronda as any}
      puntos={(puntos ?? []) as { id: string; nombre: string; ubicacion: string | null; orden: number; codigo_qr: string }[]}
      incidenciasPorPunto={incidenciasPorPunto}
      historialPorIncidencia={historialPorIncidencia}
    />
  )
}
