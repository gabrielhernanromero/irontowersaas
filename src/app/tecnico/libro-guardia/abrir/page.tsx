import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import AbrirGuardiaForm from './AbrirGuardiaForm'

interface Props {
  searchParams: { turno_id?: string; saliente_nombre?: string }
}

export default async function AbrirGuardiaPage({ searchParams }: Props) {
  const user = await requireRole('tecnico', 'admin')

  // Si ya tiene turno abierto, redirigir directamente
  const { data: turnoAbierto } = await supabaseAdmin()
    .from('libro_turno')
    .select('id')
    .eq('tecnico_id', user.id)
    .eq('estado', 'abierto')
    .maybeSingle()

  if (turnoAbierto) redirect('/tecnico/libro-guardia')

  // Perfil para pre-llenar nombre y DNI sin que el técnico tenga que escribirlos
  const { data: perfil } = await supabaseAdmin()
    .from('users')
    .select('nombre, apellido, dni')
    .eq('id', user.id)
    .single()

  const nombre = `${perfil?.nombre ?? ''} ${perfil?.apellido ?? ''}`.trim()
  const dni = perfil?.dni ?? ''

  return (
    <AbrirGuardiaForm
      tecnicoNombre={nombre}
      tecnicoDni={dni}
      turnoSalienteId={searchParams.turno_id}
      salienteNombre={searchParams.saliente_nombre}
    />
  )
}
