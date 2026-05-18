import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Users } from 'lucide-react'
import type { Cliente, UserConEmpresa } from '@/types/database'
import UsuariosClient from './UsuariosClient'

export default async function UsuariosPage() {
  await requireRole('supervisor', 'admin')

  const [{ data: tecnicosData }, { data: empresasData }] = await Promise.all([
    supabaseAdmin()
      .from('users')
      .select('id, nombre, apellido, dni, email, rol, activo, turno_habitual, cliente_id, created_at, clientes:cliente_id (id, nombre_empresa)')
      .eq('rol', 'tecnico')
      .order('apellido', { ascending: true }),
    supabaseAdmin()
      .from('clientes')
      .select('id, nombre_empresa')
      .order('nombre_empresa', { ascending: true }),
  ])

  const tecnicos = (tecnicosData ?? []) as unknown as UserConEmpresa[]
  const empresas = (empresasData ?? []) as Pick<Cliente, 'id' | 'nombre_empresa'>[]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Users size={22} className="text-brand-ink" />
        <div>
          <h1 className="text-2xl font-condensed font-bold text-brand-ink">Técnicos</h1>
          <p className="text-sm text-gray-500">
            {tecnicos.length} usuario{tecnicos.length !== 1 ? 's' : ''} registrado{tecnicos.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <UsuariosClient tecnicos={tecnicos} empresas={empresas} />
    </div>
  )
}
