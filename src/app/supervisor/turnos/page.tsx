export const dynamic = 'force-dynamic'

import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { CalendarDays } from 'lucide-react'
import AsignacionesTurnoPanel from './AsignacionesTurnoPanel'

interface TecnicoRow {
  id: string
  nombre: string
  apellido: string
  dni: string | null
  activo: boolean
}

interface ClienteRow {
  id: string
  nombre_empresa: string
}

export default async function TurnosPage() {
  await requireRole('supervisor', 'admin')

  const [{ data: tecnicos }, { data: clientes }] = await Promise.all([
    supabaseAdmin()
      .from('users')
      .select('id, nombre, apellido, dni, activo')
      .eq('rol', 'tecnico')
      .order('apellido', { ascending: true }),
    supabaseAdmin()
      .from('clientes')
      .select('id, nombre_empresa')
      .eq('activo', true)
      .order('nombre_empresa', { ascending: true }),
  ])

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-brand-orange/10 flex items-center justify-center">
          <CalendarDays size={22} className="text-brand-orange" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Turnos de Guardia</h1>
          <p className="text-sm text-gray-500">
            Configurá los bloques horarios y el personal permanente de cada objetivo
          </p>
        </div>
      </div>

      <AsignacionesTurnoPanel
        tecnicos={(tecnicos ?? []) as TecnicoRow[]}
        clientes={(clientes ?? []) as ClienteRow[]}
      />
    </div>
  )
}
