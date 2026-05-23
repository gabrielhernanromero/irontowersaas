export const dynamic = 'force-dynamic'

import { getSession } from '@/lib/auth/getSession'
import { supabaseAdmin } from '@/lib/supabase/admin'
import Link from 'next/link'
import {
  Package, CheckCircle2, Wrench, AlertTriangle, ChevronRight,
  Megaphone, AlertOctagon,
} from 'lucide-react'
import type { EstadoAdmin } from '@/types/database'

type IncRow = { id: string; estado: string; severidad: string | null }

function estadoBadge(estado: EstadoAdmin, incFalla: boolean, incExtravío: boolean) {
  if (estado === 'en_mantenimiento') {
    return { label: 'En mantenimiento', cls: 'bg-slate-100 text-slate-600', icon: <Wrench size={12} /> }
  }
  if (incExtravío) {
    return { label: 'Elemento Extraviado', cls: 'bg-red-100 text-red-700', icon: <AlertOctagon size={12} /> }
  }
  if (incFalla) {
    return { label: 'Falla reportada', cls: 'bg-orange-100 text-orange-700', icon: <AlertTriangle size={12} /> }
  }
  return { label: 'Operativo', cls: 'bg-green-100 text-green-700', icon: <CheckCircle2 size={12} /> }
}

export default async function ElementosPage() {
  const { user } = await getSession()
  const clienteId = user?.cliente_id

  const { data: elementosRaw } = clienteId
    ? await supabaseAdmin()
        .from('elementos_puesto')
        .select('id, nombre, codigo_patrimonial, categoria, estado_admin, motivo_mantenimiento, incidencias!elemento_afectado_id(id, estado, severidad)')
        .eq('cliente_id', clienteId)
        .neq('estado_admin', 'inactivo')
        .order('nombre')
    : { data: [] }

  const elementos = (elementosRaw ?? []) as {
    id: string
    nombre: string
    codigo_patrimonial: string
    categoria: string | null
    estado_admin: EstadoAdmin
    motivo_mantenimiento: string | null
    incidencias?: IncRow[]
  }[]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-condensed font-bold text-brand-ink">Elementos Asignados</h1>
        <p className="text-sm text-gray-400 mt-0.5">Inventario del puesto de control</p>
      </div>

      {elementos.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
          <Package size={48} className="opacity-30" />
          <p className="text-sm text-center">
            No hay elementos asignados a tu puesto.<br />
            Contactá al supervisor para dar de alta el inventario.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {elementos.map((el) => {
            const incAbiertas = el.incidencias?.filter((i) => i.estado === 'abierto') ?? []
            const incFalla    = incAbiertas.some((i) => i.severidad === 'medio')
            const incExtravío = incAbiertas.some((i) => i.severidad === 'alto')
            const badge = estadoBadge(el.estado_admin, incFalla, incExtravío)
            const activo = el.estado_admin === 'activo'

            return (
              <div
                key={el.id}
                className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-opacity ${
                  el.estado_admin === 'en_mantenimiento'
                    ? 'border-slate-200 opacity-70'
                    : incExtravío
                    ? 'border-red-300 opacity-60 pointer-events-none'
                    : 'border-gray-100'
                }`}
              >
                <div className="flex items-start gap-3 p-4">
                  {/* Icono estado */}
                  <div className={`mt-0.5 shrink-0 ${
                    el.estado_admin === 'en_mantenimiento' ? 'text-slate-400'
                    : incExtravío ? 'text-red-500'
                    : incFalla    ? 'text-orange-400'
                    : 'text-green-500'
                  }`}>
                    {el.estado_admin === 'en_mantenimiento'
                      ? <Wrench size={20} />
                      : incExtravío
                      ? <AlertOctagon size={20} />
                      : incFalla
                      ? <AlertTriangle size={20} />
                      : <CheckCircle2 size={20} />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-brand-ink text-base leading-tight">{el.nombre}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{el.codigo_patrimonial}</p>
                    {el.categoria && (
                      <p className="text-xs text-gray-400 capitalize">{el.categoria}</p>
                    )}

                    <div className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                      {badge.icon}
                      {badge.label}
                    </div>

                    {el.estado_admin === 'en_mantenimiento' && el.motivo_mantenimiento && (
                      <p className="text-xs text-slate-500 mt-1">{el.motivo_mantenimiento}</p>
                    )}
                  </div>
                </div>

                {/* ── Acciones ── */}
                {activo && !incExtravío && (
                  <>
                    {incFalla ? (
                      <>
                        {/* Falla ya reportada: solo permite reportar extravío */}
                        <div className="flex items-center gap-2 border-t border-orange-100 bg-orange-50 px-4 py-2">
                          <Wrench size={12} className="text-orange-500 shrink-0" />
                          <p className="text-xs text-orange-700 font-medium">
                            Falla ya reportada — solo se puede escalar a extravío
                          </p>
                        </div>
                        <Link
                          href={`/tecnico/elementos/${el.id}/reportar?tipo=extraviado`}
                          className="flex items-center justify-between gap-2 border-t border-red-100 px-4 py-3 text-red-600 font-semibold text-sm active:bg-red-50 min-h-[48px]"
                        >
                          <div className="flex items-center gap-2">
                            <AlertOctagon size={16} />
                            Reportar extravío
                          </div>
                          <ChevronRight size={16} className="text-gray-300" />
                        </Link>
                      </>
                    ) : (
                      /* Sin incidencias: flujo normal */
                      <Link
                        href={`/tecnico/elementos/${el.id}/reportar`}
                        className="flex items-center justify-between gap-2 border-t border-gray-100 px-4 py-3 text-brand-orange font-semibold text-sm active:bg-orange-50 min-h-[48px]"
                      >
                        <div className="flex items-center gap-2">
                          <Megaphone size={16} />
                          Reportar novedad
                        </div>
                        <ChevronRight size={16} className="text-gray-300" />
                      </Link>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
