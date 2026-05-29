export const dynamic = 'force-dynamic'

import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ClipboardCheck } from 'lucide-react'
import RondasSupervisorClient from './RondasSupervisorClient'

export default async function RondasPage() {
  await requireRole('supervisor', 'admin')

  const hoy = new Date().toISOString().split('T')[0]
  const hace7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [{ data: rondas }, { data: clientes }] = await Promise.all([
    supabaseAdmin()
      .from('rondas')
      .select(`
        id, turno_id, tecnico_id, cliente_id, numero_ronda,
        hora_inicio, hora_fin, total_puntos, puntos_escaneados, completa, created_at,
        clientes(id, nombre_empresa),
        ronda_scans(id, punto_control_id, escaneado_at,
          puntos_control(id, nombre, ubicacion)
        )
      `)
      .gte('hora_inicio', `${hace7}T00:00:00-03:00`)
      .order('hora_inicio', { ascending: false })
      .limit(100),

    supabaseAdmin()
      .from('clientes')
      .select('id, nombre_empresa')
      .eq('activo', true)
      .order('nombre_empresa'),
  ])

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-brand-orange/10 flex items-center justify-center">
          <ClipboardCheck size={22} className="text-brand-orange" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Control de Rondas</h1>
          <p className="text-sm text-gray-500">Cumplimiento de rondas por cliente y turno</p>
        </div>
      </div>

      <RondasSupervisorClient
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        initialRondas={(rondas ?? []) as any[]}
        clientes={(clientes ?? []) as { id: string; nombre_empresa: string }[]}
      />
    </div>
  )
}
