export const dynamic = 'force-dynamic'

import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Target } from 'lucide-react'
import ClientesClient from './ClientesClient'
import type { Cliente, ElementoPuesto } from '@/types/database'

interface TecnicoRow {
  id: string
  nombre: string
  apellido: string
  dni: string | null
  turno_habitual: string | null
  rol_habitual: 'encargado' | 'apoyo' | null
  activo: boolean
  cliente_id: string | null
}

export default async function ClientesPage() {
  await requireRole('supervisor', 'admin')

  const [
    { data: clientes },
    { data: elementos },
    { data: tecnicos },
  ] = await Promise.all([
    supabaseAdmin()
      .from('clientes')
      .select('id, nombre_empresa, cuit, direccion, contacto_nombre, contacto_email, contacto_telefono, activo, frecuencia_ronda_minutos, aviso_ronda_minutos, created_at')
      .order('nombre_empresa', { ascending: true }),
    supabaseAdmin()
      .from('elementos_puesto')
      .select('id, cliente_id, nombre, codigo_patrimonial, categoria, descripcion, estado_admin, fecha_retiro_mantenimiento, motivo_mantenimiento, created_at')
      .order('nombre', { ascending: true }),
    supabaseAdmin()
      .from('users')
      .select('id, nombre, apellido, dni, turno_habitual, rol_habitual, activo, cliente_id')
      .eq('rol', 'tecnico')
      .order('apellido', { ascending: true }),
  ])

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-brand-orange/10 flex items-center justify-center">
          <Target size={22} className="text-brand-orange" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes y Objetivos</h1>
          <p className="text-sm text-gray-500">
            Empresas contratantes, inventario de puestos y técnicos asignados
          </p>
        </div>
      </div>

      <ClientesClient
        initialClientes={(clientes ?? []) as Cliente[]}
        initialElementos={(elementos ?? []) as ElementoPuesto[]}
        initialTecnicos={(tecnicos ?? []) as TecnicoRow[]}
      />
    </div>
  )
}
