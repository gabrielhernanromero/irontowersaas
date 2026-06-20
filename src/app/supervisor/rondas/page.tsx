export const dynamic = 'force-dynamic'

import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ClipboardCheck } from 'lucide-react'
import RondasSupervisorClient from './RondasSupervisorClient'

export default async function RondasPage() {
  await requireRole('supervisor', 'admin')

  const hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' })

  const [{ data: rondas }, { data: clientes }, { data: tecnicos }, { data: rutasRaw }] = await Promise.all([
    supabaseAdmin()
      .from('rondas')
      .select(`
        id, turno_id, tecnico_id, cliente_id, numero_ronda,
        hora_inicio, hora_fin, total_puntos, puntos_escaneados, completa, created_at,
        clientes(id, nombre_empresa),
        tecnico:users!tecnico_id(id, nombre, apellido),
        ronda_scans(id, punto_control_id, escaneado_at, novedad_id, foto_url,
          puntos_control(id, nombre, ubicacion)
        )
      `)
      .gte('hora_inicio', `${hace30}T00:00:00-03:00`)
      .order('hora_inicio', { ascending: false })
      .limit(500),

    supabaseAdmin()
      .from('clientes')
      .select('id, nombre_empresa')
      .eq('activo', true)
      .order('nombre_empresa'),

    supabaseAdmin()
      .from('users')
      .select('id, nombre, apellido')
      .eq('rol', 'tecnico')
      .eq('activo', true)
      .order('apellido'),

    supabaseAdmin()
      .from('clientes')
      .select(`
        id, nombre_empresa, frecuencia_ronda_minutos, aviso_ronda_minutos,
        puntos_control(id, nombre, ubicacion, orden, activo, codigo_qr),
        esquemas_cobertura(id, hora_inicio, hora_fin, activo, dias_semana)
      `)
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
          <p className="text-sm text-gray-500">Monitoreo y cumplimiento de rondas por cliente</p>
        </div>
      </div>

      <RondasSupervisorClient
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        initialRondas={(rondas ?? []) as any[]}
        clientes={(clientes ?? []) as { id: string; nombre_empresa: string }[]}
        tecnicos={(tecnicos ?? []) as { id: string; nombre: string; apellido: string }[]}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rutas={(rutasRaw ?? []) as any[]}
      />
    </div>
  )
}
