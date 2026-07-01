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
      ronda_scans(id, punto_control_id, escaneado_at)
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

  return (
    <RondaActivaClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ronda={ronda as any}
      puntos={(puntos ?? []) as { id: string; nombre: string; ubicacion: string | null; orden: number; codigo_qr: string }[]}
    />
  )
}
