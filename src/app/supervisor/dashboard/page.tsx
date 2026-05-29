export const dynamic = 'force-dynamic'

import { requireRole } from '@/lib/auth/requireRole'
import { getSession } from '@/lib/auth/getSession'
import { supabaseAdmin } from '@/lib/supabase/admin'
import DashboardClient from './DashboardClient'

function todayStartAR(): string {
  const now  = new Date()
  const arMs = now.getTime() - 3 * 60 * 60 * 1000
  const day  = new Date(arMs).toISOString().split('T')[0]
  return new Date(`${day}T00:00:00-03:00`).toISOString()
}

export default async function DashboardPage() {
  await requireRole('supervisor', 'admin')
  const { user } = await getSession()

  const todayStart = todayStartAR()

  const [
    { data: turnosRaw },
    { data: novedadesRaw },
    { data: incidenciasRaw },
    { count: alertasSinLeer },
    { data: clientes },
    { count: turnosCerradosHoy },
    { count: incidenciasNuevasHoy },
  ] = await Promise.all([
    supabaseAdmin()
      .from('libro_turno')
      .select(`
        id, folio_numero, fecha, turno, tecnico_nombre, tecnico_dni,
        horario_inicio, horario_fin, estado, cliente_id, created_at,
        clientes(id, nombre_empresa),
        novedades:libro_novedad(id, tipo, hora, descripcion, created_at)
      `)
      .in('estado', ['abierto', 'pendiente_relevo'])
      .order('horario_inicio', { ascending: false }),

    supabaseAdmin()
      .from('libro_novedad')
      .select(`
        id, turno_id, tipo, hora, descripcion, incidencia_id, created_at,
        libro_turno(id, tecnico_nombre, cliente_id, clientes(id, nombre_empresa))
      `)
      .gte('created_at', todayStart)
      .order('created_at', { ascending: false })
      .limit(50),

    supabaseAdmin()
      .from('incidencias')
      .select(`
        id, cliente_id, titulo, descripcion, severidad, estado,
        elemento_afectado_id, created_at,
        clientes(id, nombre_empresa),
        elemento:elementos_puesto(id, nombre, codigo_patrimonial)
      `)
      .eq('estado', 'abierto')
      .order('created_at', { ascending: false }),

    supabaseAdmin()
      .from('alertas')
      .select('id', { count: 'exact', head: true })
      .eq('destinatario_id', user!.id)
      .eq('leida', false),

    supabaseAdmin()
      .from('clientes')
      .select('id, nombre_empresa')
      .eq('activo', true)
      .order('nombre_empresa'),

    supabaseAdmin()
      .from('libro_turno')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'cerrado')
      .gte('created_at', todayStart),

    supabaseAdmin()
      .from('incidencias')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'abierto')
      .gte('created_at', todayStart),
  ])

  return (
    <DashboardClient
      supervisorId={user!.id}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialTurnos={(turnosRaw    ?? []) as any[]}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialNovedades={(novedadesRaw   ?? []) as any[]}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialIncidencias={(incidenciasRaw ?? []) as any[]}
      initialAlertasSinLeer={alertasSinLeer ?? 0}
      clientes={(clientes ?? []) as { id: string; nombre_empresa: string }[]}
      resumenDia={{
        turnosCerrados:       turnosCerradosHoy   ?? 0,
        novedadesHoy:         novedadesRaw?.length ?? 0,
        incidenciasNuevasHoy: incidenciasNuevasHoy ?? 0,
      }}
    />
  )
}
