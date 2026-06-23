export const dynamic = 'force-dynamic'

import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import AbrirGuardiaForm from './AbrirGuardiaForm'
import { findEsquemaActivo } from '@/lib/esquemas/validarVentana'

interface Props {
  searchParams: { turno_id?: string; saliente_nombre?: string }
}

function turnoDesdeHora(hora: string): 'diurno' | 'nocturno' {
  const [h] = hora.split(':').map(Number)
  return h >= 6 && h < 18 ? 'diurno' : 'nocturno'
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AbrirGuardiaPage({ searchParams }: Props) {
  const user = await requireRole('tecnico', 'admin')

  // Si ya tiene turno abierto, redirigir
  const { data: turnoAbierto } = await supabaseAdmin()
    .from('libro_turno')
    .select('id')
    .eq('tecnico_id', user.id)
    .eq('estado', 'abierto')
    .maybeSingle()

  if (turnoAbierto) redirect('/tecnico/libro-guardia')

  // Perfil completo del técnico
  const { data: perfil } = await supabaseAdmin()
    .from('users')
    .select('nombre, apellido, dni, cliente_id, turno_habitual')
    .eq('id', user.id)
    .single()

  const nombre        = `${perfil?.nombre ?? ''} ${perfil?.apellido ?? ''}`.trim()
  const dni           = perfil?.dni ?? ''
  const clienteIdFijo = perfil?.cliente_id ?? null

  const { data: clientes } = await supabaseAdmin()
    .from('clientes')
    .select('id, nombre_empresa')
    .order('nombre_empresa', { ascending: true })

  // ── Buscar el esquema de cobertura activo para este momento ─────────────────
  let esquemaActivo: { nombre: string; hora_inicio: string; hora_fin: string } | null = null
  let turnoConfig: 'diurno' | 'nocturno' | null = null
  let validacionBloqueada = false

  if (clienteIdFijo) {
    const { data: esquemas } = await supabaseAdmin()
      .from('esquemas_cobertura')
      .select('nombre, hora_inicio, hora_fin, activo, dias_semana, fecha_desde, fecha_hasta')
      .eq('cliente_id', clienteIdFijo)
      .eq('activo', true)

    if (esquemas && esquemas.length > 0) {
      const encontrado = findEsquemaActivo(esquemas)

      if (encontrado) {
        esquemaActivo = {
          nombre:      encontrado.nombre,
          hora_inicio: encontrado.hora_inicio,
          hora_fin:    encontrado.hora_fin,
        }
        turnoConfig = turnoDesdeHora(encontrado.hora_inicio)
      } else {
        // Hay esquemas configurados pero ninguno corresponde a este momento → bloquear
        validacionBloqueada = true
      }
    }
    // Si el cliente no tiene esquemas configurados → no bloqueamos (sin configuración = sin restricción)
  }

  // Fallback: usar turno_habitual del perfil si no hay esquema activo
  if (!turnoConfig && perfil?.turno_habitual) {
    turnoConfig = perfil.turno_habitual
  }

  return (
    <AbrirGuardiaForm
      tecnicoNombre={nombre}
      tecnicoDni={dni}
      turnoSalienteId={searchParams.turno_id}
      salienteNombre={searchParams.saliente_nombre}
      clientes={clientes ?? []}
      defaultClienteId={clienteIdFijo ?? undefined}
      clienteIdFijo={clienteIdFijo ?? undefined}
      esquema={esquemaActivo}
      turnoConfig={turnoConfig}
      validacionBloqueada={validacionBloqueada}
    />
  )
}
