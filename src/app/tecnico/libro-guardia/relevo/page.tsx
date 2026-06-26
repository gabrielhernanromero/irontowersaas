import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { Incidencia, LibroNovedad } from '@/types/database'
import RelevoPForm from './RelevoPForm'
import type { EstadoAdmin } from '@/types/database'

type ElementoParaRelevo = {
  id: string
  nombre: string
  codigo_patrimonial: string
  estado_admin: EstadoAdmin
  motivo_mantenimiento: string | null
  incidencias?: { id: string; estado: string }[]
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

  // Perfil del técnico entrante para pre-llenar nombre/DNI
  const { data: perfil } = await supabaseAdmin()
    .from('users')
    .select('nombre, apellido, dni')
    .eq('id', me.id)
    .single()

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
        .select('id, nombre, codigo_patrimonial, estado_admin, motivo_mantenimiento, incidencias!elemento_afectado_id(id, estado)')
        .eq('cliente_id', turno.cliente_id)
        .neq('estado_admin', 'inactivo')
        .order('nombre')
    : { data: [] }
  const elementos = (elementosData ?? []) as ElementoParaRelevo[]

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
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <div>
            <p className="text-xs text-gray-400">Técnico</p>
            <p className="font-semibold text-brand-ink">{turno.tecnico_nombre}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">DNI</p>
            <p className="font-semibold text-brand-ink">{turno.tecnico_dni}</p>
          </div>
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
        {apoyosSalientes.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-2">Apoyo</p>
            <div className="space-y-1">
              {apoyosSalientes.map(a => (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-brand-ink">{a.nombre}</span>
                  {a.dni && <span className="text-gray-500 text-xs">DNI {a.dni}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
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
      />
    </div>
  )
}
