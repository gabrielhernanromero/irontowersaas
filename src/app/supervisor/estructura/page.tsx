export const dynamic = 'force-dynamic'

import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Building2 } from 'lucide-react'
import EstructuraClient from './EstructuraClient'
import type { Cliente, ElementoPuesto } from '@/types/database'

export default async function EstructuraPage() {
  await requireRole('supervisor', 'admin')

  const [{ data: puestos }, { data: elementos }] = await Promise.all([
    supabaseAdmin()
      .from('clientes')
      .select('id, nombre_empresa, cuit, direccion, contacto_nombre, contacto_email, contacto_telefono, activo, created_at')
      .order('nombre_empresa', { ascending: true }),
    supabaseAdmin()
      .from('elementos_puesto')
      .select('*, clientes(id, nombre_empresa)')
      .order('nombre', { ascending: true }),
  ])

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-brand-orange/10 flex items-center justify-center">
          <Building2 size={22} className="text-brand-orange" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estructura</h1>
          <p className="text-sm text-gray-500">Puestos de trabajo e inventario de elementos</p>
        </div>
      </div>

      <EstructuraClient
        initialPuestos={(puestos ?? []) as Cliente[]}
        initialElementos={(elementos ?? []) as (ElementoPuesto & { clientes: { id: string; nombre_empresa: string } | null })[]}
      />
    </div>
  )
}
