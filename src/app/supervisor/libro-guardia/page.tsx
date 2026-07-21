export const dynamic = 'force-dynamic'

import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { BookOpen } from 'lucide-react'
import LibroGuardiaClient from './LibroGuardiaClient'

type Rango = 'hoy' | '7d' | '30d'

function desdeAR(rango: Rango): string {
  const dias = rango === 'hoy' ? 0 : rango === '7d' ? 7 : 30
  const now  = new Date()
  const arMs = now.getTime() - 3 * 60 * 60 * 1000
  const day  = new Date(arMs - dias * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  return new Date(`${day}T00:00:00-03:00`).toISOString()
}

export default async function LibroGuardiaPage({
  searchParams,
}: {
  searchParams: { cliente_id?: string; rango?: string }
}) {
  await requireRole('supervisor', 'admin')

  const clienteId = searchParams.cliente_id ?? null
  const rango: Rango = searchParams.rango === 'hoy' || searchParams.rango === '30d' ? searchParams.rango : '7d'

  let query = supabaseAdmin()
    .from('libro_turno')
    .select(`
      id, folio_numero, fecha, turno, tecnico_nombre, tecnico_dni,
      horario_inicio, horario_fin, estado, cliente_id, created_at,
      clientes(id, nombre_empresa)
    `)
    .gte('created_at', desdeAR(rango))
    .order('horario_inicio', { ascending: false })

  if (clienteId) query = query.eq('cliente_id', clienteId)

  const [{ data: turnos }, { data: clientes }] = await Promise.all([
    query,
    supabaseAdmin().from('clientes').select('id, nombre_empresa').eq('activo', true).order('nombre_empresa'),
  ])

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-brand-orange/10 flex items-center justify-center">
          <BookOpen size={20} className="text-brand-orange" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Libro de Guardia</h1>
          <p className="text-sm text-gray-500">Historial de turnos — en vivo y cerrados</p>
        </div>
      </div>

      <LibroGuardiaClient
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        turnos={(turnos ?? []) as any[]}
        clientes={(clientes ?? []) as { id: string; nombre_empresa: string }[]}
        clienteId={clienteId}
        rango={rango}
      />
    </div>
  )
}
