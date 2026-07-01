import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import SupervisoresClient from './SupervisoresClient'

export const dynamic = 'force-dynamic'

export default async function SupervisoresPage() {
  await requireRole('admin')

  const { data: supervisores } = await supabaseAdmin()
    .from('users')
    .select('id, nombre, apellido, dni, email, rol, activo, created_at')
    .eq('rol', 'supervisor')
    .order('apellido', { ascending: true })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-ink">Supervisores</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gestioná las cuentas del equipo supervisor de Iron Tower.
        </p>
      </div>

      <SupervisoresClient supervisores={supervisores ?? []} />
    </div>
  )
}
