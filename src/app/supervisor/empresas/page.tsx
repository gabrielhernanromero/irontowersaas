import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Building2 } from 'lucide-react'
import type { Cliente } from '@/types/database'
import EmpresasClient from './EmpresasClient'

interface TecnicoRow {
  id: string
  nombre: string
  apellido: string
  dni: string | null
  turno_habitual: string | null
  activo: boolean
}

export interface EmpresaConTecnicos extends Cliente {
  tecnicos: TecnicoRow[]
}

export default async function EmpresasPage() {
  await requireRole('supervisor', 'admin')

  const { data } = await supabaseAdmin()
    .from('clientes')
    .select(`
      id, nombre_empresa, cuit, direccion, contacto_nombre, contacto_email, contacto_telefono, created_at,
      tecnicos:users!users_cliente_id_fkey (id, nombre, apellido, dni, turno_habitual, activo)
    `)
    .order('nombre_empresa', { ascending: true })

  const empresas = (data ?? []) as unknown as EmpresaConTecnicos[]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Building2 size={22} className="text-brand-ink" />
        <div>
          <h1 className="text-2xl font-condensed font-bold text-brand-ink">Empresas</h1>
          <p className="text-sm text-gray-500">
            {empresas.length} empresa{empresas.length !== 1 ? 's' : ''} contratante{empresas.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <EmpresasClient empresas={empresas} />
    </div>
  )
}
