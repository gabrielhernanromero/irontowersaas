export const dynamic = 'force-dynamic'

import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { Incidencia, LibroNovedad } from '@/types/database'
import RelevoPForm from './RelevoPForm'
import type { EstadoAdmin } from '@/types/database'
import { findEsquemaActivo, type EsquemaVentana } from '@/lib/esquemas/validarVentana'
import { getArgTime } from '@/lib/cobertura/timeUtils'

type ElementoParaRelevo = {
  id: string
  nombre: string
  codigo_patrimonial: string
  estado_admin: EstadoAdmin
  motivo_mantenimiento: string | null
  incidencias?: {
    id: string
    estado: string
    titulo: string
    descripcion: string
    severidad: 'bajo' | 'medio' | 'alto' | null
    created_at: string
    libro_turno: { tecnico_nombre: string; tecnico_dni: string } | null
  }[]
}

function formatFecha(f: string | null) {
  if (!f) return '—'
  const [y, m, d] = f.split('-')
  return `${d}/${m}/${y}`
}

interface Props {
  searchParams: { turno_id?: string }
}

export default async function RelevoPPage({ searchParams }: Props) {
  const me = await requireRole('tecnico', 'admin')

  const turnoId = searchParams.turno_id ?? ''

  if (!turnoId) {
    return (
      <div className="py-12 text-center text-gray-500">
        <p>Parámetro turno_id faltante.</p>
        <Link href="/tecnico/libro-guardia" className="text-brand-orange underline mt-2 block">Volver</Link>
      </div>
    )
  }

  const { data: turno } = await supabaseAdmin()
    .from('libro_turno')
    .select('id, folio_numero, tecnico_nombre, tecnico_dni, fecha, turno, horario_inicio, horario_fin, estado, cliente_id')
    .eq('id', turnoId)
    .single()

  if (!turno) {
    return (
      <div className="py-12 text-center text-gray-500">
        <p>Turno no encontrado.</p>
        <Link href="/tecnico/libro-guardia" className="text-brand-orange underline mt-2 block">Volver</Link>
      </div>
    )
  }

  if (turno.estado !== 'pendiente_relevo') {
    return (
      <div className="py-12 text-center text-gray-500">
        <p>Este turno no está pendiente de relevo.</p>
        <Link href="/tecnico/libro-guardia" className="text-brand-orange underline mt-2 block">Volver</Link>
      </div>
    )
  }

  // Perfil del técnico entrante para pre-llenar nombre/DNI y verificar autorización
  const { data: perfil } = await supabaseAdmin()
    .from('users')
    .select('nombre, apellido, dni, rol, cliente_id')
    .eq('id', me.id)
    .single()

  // Guard: solo el encargado dentro de su franja horaria puede firmar el relevo
  // Los admins están exentos para permitir operaciones de soporte
  // Se itera cada esquema individualmente (como en el hub) para evitar que
  // findEsquemaActivo devuelva el esquema incorrecto en período de solapamiento.
  let esquemaActivoId: string | null = null

  if (perfil?.rol !== 'admin') {
    const clienteIdTecnico = perfil?.cliente_id ?? null
    let autorizado = false

    if (clienteIdTecnico) {
      const { data: esquemasRaw } = await supabaseAdmin()
        .from('esquemas_cobertura')
        .select('id, nombre, hora_inicio, hora_fin, activo, dias_semana, fecha_desde, fecha_hasta')
        .eq('cliente_id', clienteIdTecnico)
        .eq('activo', true)

      const { hoy, ayer } = getArgTime()

      for (const esq of (esquemasRaw ?? [])) {
        if (!findEsquemaActivo([esq as EsquemaVentana])) continue
        const esquemaId = (esq as EsquemaVentana & { id: string }).id

        const { data: exc } = await supabaseAdmin()
          .from('asignaciones_turno')
          .select('rol_turno')
          .eq('esquema_id', esquemaId)
          .eq('usuario_id', me.id)
          .in('fecha', [hoy, ayer])
          .maybeSingle()

        if (exc?.rol_turno === 'encargado') { autorizado = true; esquemaActivoId = esquemaId; break }

        if (!exc) {
          const { data: pers } = await supabaseAdmin()
            .from('asignaciones_persistentes')
            .select('rol_turno')
            .eq('esquema_id', esquemaId)
            .eq('usuario_id', me.id)
            .maybeSingle()
          if (pers?.rol_turno === 'encargado') { autorizado = true; esquemaActivoId = esquemaId; break }
        }
      }
    }

    if (!autorizado) redirect('/tecnico/libro-guardia')
  }

  // Apoyo esperado para el turno entrante (excepción → persistente, excluyendo el encargado)
  type PersonalApoyoRelevo = { usuario_id: string; nombre: string }
  let personalApoyoEntrante: PersonalApoyoRelevo[] = []
  if (esquemaActivoId) {
    const { hoy: hoyA, ayer: ayerA } = getArgTime()
    const { data: excApoyo } = await supabaseAdmin()
      .from('asignaciones_turno')
      .select('usuario:usuario_id(id, nombre, apellido)')
      .eq('esquema_id', esquemaActivoId)
      .eq('rol_turno', 'apoyo')
      .in('fecha', [hoyA, ayerA])
      .neq('usuario_id', me.id)
    let apoyoRaw = (excApoyo ?? []) as { usuario: unknown }[]
    if (apoyoRaw.length === 0) {
      const { data: persApoyo } = await supabaseAdmin()
        .from('asignaciones_persistentes')
        .select('usuario:usuario_id(id, nombre, apellido)')
        .eq('esquema_id', esquemaActivoId)
        .eq('rol_turno', 'apoyo')
        .neq('usuario_id', me.id)
      apoyoRaw = (persApoyo ?? []) as { usuario: unknown }[]
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    personalApoyoEntrante = apoyoRaw.map((a: any) => a.usuario).filter(Boolean)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((u: any) => ({ usuario_id: u.id, nombre: `${u.nombre} ${u.apellido}`.trim() }))
  }

  const entranteNombre = `${perfil?.nombre ?? ''} ${perfil?.apellido ?? ''}`.trim()
  const entranteDni = perfil?.dni ?? ''

  // Personal de apoyo del turno saliente
  const { data: participaciones } = await supabaseAdmin()
    .from('participaciones_turno')
    .select('usuario_id, users!usuario_id(nombre, apellido, dni)')
    .eq('turno_id', turnoId)

  const apoyosSalientes = ((participaciones ?? []) as unknown as {
    usuario_id: string
    users: { nombre: string; apellido: string; dni: string | null } | null
  }[]).map(p => ({
    id:      p.usuario_id,
    nombre:  `${p.users?.nombre ?? ''} ${p.users?.apellido ?? ''}`.trim(),
    dni:     p.users?.dni ?? null,
  }))

  // Novedades con join a incidencias para mostrar badge
  const { data: novedadesRaw } = await supabaseAdmin()
    .from('libro_novedad')
    .select('*, incidencias(id, titulo, severidad, estado)')
    .eq('turno_id', turnoId)
    .order('created_at', { ascending: true })

  // Incidencias activas en el puesto (de cualquier turno anterior)
  const incidenciasQuery = turno.cliente_id
    ? supabaseAdmin().from('incidencias').select('*, libro_turno!turno_creacion_id(tecnico_nombre, tecnico_dni)').eq('cliente_id', turno.cliente_id).eq('estado', 'abierto').order('created_at', { ascending: true })
    : supabaseAdmin().from('incidencias').select('*, libro_turno!turno_creacion_id(tecnico_nombre, tecnico_dni)').is('cliente_id', null).eq('estado', 'abierto').order('created_at', { ascending: true })
  const { data: incidenciasData } = await incidenciasQuery
  const incidenciasActivas = (incidenciasData ?? []) as Incidencia[]

  // Inventario del puesto para el checklist de relevo
  const { data: elementosData } = turno.cliente_id
    ? await supabaseAdmin()
        .from('elementos_puesto')
        .select('id, nombre, codigo_patrimonial, estado_admin, motivo_mantenimiento, incidencias!elemento_afectado_id(id, estado, titulo, descripcion, severidad, created_at, libro_turno!turno_creacion_id(tecnico_nombre, tecnico_dni))')
        .eq('cliente_id', turno.cliente_id)
        .neq('estado_admin', 'inactivo')
        .order('nombre')
    : { data: [] }
  const elementos = (elementosData ?? []) as unknown as ElementoParaRelevo[]

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <Link href="/tecnico/libro-guardia" className="p-2 -ml-2 text-gray-500 min-h-[44px] flex items-center">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-condensed font-bold text-brand-ink">Tomar relevo</h1>
      </div>

      {/* Datos del turno saliente */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5 shadow-sm">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Turno saliente</p>
        <div className="flex flex-col gap-3 text-sm">
          {/* Encargado */}
          <div className="grid grid-cols-2 gap-y-1">
            <div>
              <p className="text-xs text-gray-400">Técnico</p>
              <p className="font-semibold text-brand-ink">{turno.tecnico_nombre}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">DNI</p>
              <p className="font-semibold text-brand-ink">{turno.tecnico_dni}</p>
            </div>
          </div>
          {/* Apoyo(s) */}
          {apoyosSalientes.map(a => (
            <div key={a.id} className="grid grid-cols-2 gap-y-1">
              <div>
                <p className="text-xs text-gray-400">Apoyo</p>
                <p className="font-medium text-brand-ink">{a.nombre}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">DNI</p>
                <p className="font-medium text-brand-ink">{a.dni ?? '—'}</p>
              </div>
            </div>
          ))}
          {/* Folio y fecha al final con separador */}
          <div className="grid grid-cols-2 gap-y-1 pt-2 border-t border-gray-100">
            <div>
              <p className="text-xs text-gray-400">Folio / Turno</p>
              <p className="font-medium text-brand-ink capitalize">#{turno.folio_numero} — {turno.turno}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Fecha / Hora</p>
              <p className="font-medium text-brand-ink">
                {formatFecha(turno.fecha)} {turno.horario_inicio?.slice(0, 5)}–{turno.horario_fin?.slice(0, 5) ?? '?'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <RelevoPForm
        turnoSalienteId={turnoId}
        salienteNombre={turno.tecnico_nombre}
        salienteDNI={turno.tecnico_dni}
        clienteId={turno.cliente_id ?? ''}
        novedades={(novedadesRaw ?? []) as LibroNovedad[]}
        incidenciasActivas={incidenciasActivas}
        elementos={elementos}
        entranteNombre={entranteNombre}
        entranteDni={entranteDni}
        personalApoyo={personalApoyoEntrante}
      />
    </div>
  )
}
