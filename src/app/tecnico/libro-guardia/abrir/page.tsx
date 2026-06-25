export const dynamic = 'force-dynamic'

import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import AbrirGuardiaForm from './AbrirGuardiaForm'
import { findEsquemaActivo } from '@/lib/esquemas/validarVentana'
import { getArgTime } from '@/lib/cobertura/timeUtils'

interface Props {
  searchParams: { turno_id?: string; saliente_nombre?: string; interino?: string }
}

interface PersonalApoyo {
  usuario_id: string
  nombre: string
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
  let esquemaActivo: { id: string; nombre: string; hora_inicio: string; hora_fin: string } | null = null
  let turnoConfig: 'diurno' | 'nocturno' | null = null
  let validacionBloqueada = false
  let personalApoyo: PersonalApoyo[] = []

  if (clienteIdFijo) {
    const { data: esquemasRaw } = await supabaseAdmin()
      .from('esquemas_cobertura')
      .select('id, nombre, hora_inicio, hora_fin, activo, dias_semana, fecha_desde, fecha_hasta')
      .eq('cliente_id', clienteIdFijo)
      .eq('activo', true)

    if (esquemasRaw && esquemasRaw.length > 0) {
      const encontrado = findEsquemaActivo(esquemasRaw as any) as (typeof esquemasRaw[0]) | null

      if (encontrado) {
        // Verificar que el usuario está asignado como encargado de este esquema
        const { hoy, ayer } = getArgTime()

        const { data: excepcion } = await supabaseAdmin()
          .from('asignaciones_turno')
          .select('rol_turno')
          .eq('esquema_id', encontrado.id)
          .eq('usuario_id', user.id)
          .in('fecha', [hoy, ayer])
          .maybeSingle()

        let rolAsignado: string | null = excepcion?.rol_turno ?? null

        if (!rolAsignado) {
          const { data: persistente } = await supabaseAdmin()
            .from('asignaciones_persistentes')
            .select('rol_turno')
            .eq('esquema_id', encontrado.id)
            .eq('usuario_id', user.id)
            .maybeSingle()
          rolAsignado = persistente?.rol_turno ?? null
        }

        if (rolAsignado === 'encargado' || searchParams.interino === '1') {
          esquemaActivo = {
            id:          encontrado.id,
            nombre:      encontrado.nombre,
            hora_inicio: encontrado.hora_inicio,
            hora_fin:    encontrado.hora_fin,
          }
          turnoConfig = turnoDesdeHora(encontrado.hora_inicio)

          // Personal de apoyo: override del día primero, luego persistente.
          // Se excluye al usuario que abre (para el caso interino que es apoyo del esquema).
          const { data: excepcionesApoyo } = await supabaseAdmin()
            .from('asignaciones_turno')
            .select('usuario:usuario_id(id, nombre, apellido)')
            .eq('esquema_id', encontrado.id)
            .eq('rol_turno', 'apoyo')
            .in('fecha', [hoy, ayer])
            .neq('usuario_id', user.id)

          let apoyoRaw: { usuario: unknown }[] = excepcionesApoyo ?? []

          if (apoyoRaw.length === 0) {
            const { data: persistentesApoyo } = await supabaseAdmin()
              .from('asignaciones_persistentes')
              .select('usuario:usuario_id(id, nombre, apellido)')
              .eq('esquema_id', encontrado.id)
              .eq('rol_turno', 'apoyo')
              .neq('usuario_id', user.id)
            apoyoRaw = persistentesApoyo ?? []
          }

          personalApoyo = apoyoRaw
            .map((a: any) => a.usuario)
            .filter(Boolean)
            .map((u: any) => ({ usuario_id: u.id, nombre: `${u.nombre} ${u.apellido}`.trim() }))
        } else {
          // Esquema activo pero este usuario no es el encargado asignado
          validacionBloqueada = true
        }
      } else {
        // Hay esquemas configurados pero ninguno corresponde a este momento → bloquear
        // Excepto si es modo interino (apoyo abriendo porque el encargado no se presentó)
        if (searchParams.interino !== '1') validacionBloqueada = true
      }
    }
    // Si el cliente no tiene esquemas configurados → no bloqueamos (sin configuración = sin restricción)
  }

  // Fallback: usar turno_habitual del perfil si no hay esquema activo
  if (!turnoConfig && perfil?.turno_habitual) {
    turnoConfig = perfil.turno_habitual
  }

  // ── Elementos asignados al puesto ───────────────────────────────────────────
  let elementos: { id: string; nombre: string; codigo_patrimonial: string; categoria: string | null }[] = []
  if (clienteIdFijo) {
    const { data: elems } = await supabaseAdmin()
      .from('elementos_puesto')
      .select('id, nombre, codigo_patrimonial, categoria')
      .eq('cliente_id', clienteIdFijo)
      .eq('estado_admin', 'activo')
      .order('nombre', { ascending: true })
    elementos = elems ?? []
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
      elementos={elementos}
      personalApoyo={personalApoyo}
      interino={searchParams.interino === '1'}
    />
  )
}
