'use client'

import { useState } from 'react'
import {
  Package, Wrench, CheckCircle2, AlertTriangle, ChevronRight,
} from 'lucide-react'
import ReportarFallaSheet from './ReportarFallaSheet'
import type { EstadoAdmin } from '@/types/database'

interface Elemento {
  id: string
  nombre: string
  codigo_patrimonial: string
  categoria: string | null
  estado_admin: EstadoAdmin
  motivo_mantenimiento: string | null
  incidencias?: { id: string; estado: string }[]
}

interface Props {
  elementos: Elemento[]
  turnoId: string | null
}

export default function InventarioSection({ elementos, turnoId }: Props) {
  const [fallaTarget, setFallaTarget] = useState<Elemento | null>(null)
  const [exito, setExito] = useState<string | null>(null)

  if (elementos.length === 0) return null

  function handleSuccess() {
    setExito(fallaTarget?.nombre ?? '')
    setFallaTarget(null)
    setTimeout(() => setExito(null), 4000)
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
          <Package size={14} />
          Inventario asignado al puesto
        </h2>

        {exito && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
            <CheckCircle2 size={14} className="text-green-600" />
            <p className="text-xs text-green-800 font-medium">
              Falla reportada: <strong>{exito}</strong>
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {elementos.map((el) => {
            const enMantenimiento = el.estado_admin === 'en_mantenimiento'
            const incAbierta = el.incidencias?.some((i) => i.estado === 'abierto')

            return (
              <div
                key={el.id}
                className={`rounded-xl border p-4 flex items-start gap-3 ${
                  enMantenimiento
                    ? 'bg-slate-50 border-slate-200 opacity-60'
                    : incAbierta
                    ? 'bg-orange-50 border-orange-200'
                    : 'bg-white border-gray-100'
                }`}
              >
                <div className={`mt-0.5 shrink-0 ${enMantenimiento ? 'text-slate-400' : incAbierta ? 'text-orange-400' : 'text-green-500'}`}>
                  {enMantenimiento ? (
                    <Wrench size={18} />
                  ) : incAbierta ? (
                    <AlertTriangle size={18} />
                  ) : (
                    <CheckCircle2 size={18} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-brand-ink text-sm">{el.nombre}</p>
                  <p className="text-xs text-gray-400">{el.codigo_patrimonial}</p>
                  {enMantenimiento && el.motivo_mantenimiento && (
                    <p className="text-xs text-slate-500 mt-1">
                      Retirado para mantenimiento: {el.motivo_mantenimiento}
                    </p>
                  )}
                  {incAbierta && (
                    <p className="text-xs text-orange-600 mt-1 font-medium">Incidencia abierta</p>
                  )}
                  {!enMantenimiento && !incAbierta && (
                    <p className="text-xs text-green-600 mt-1">Operativo</p>
                  )}
                </div>

                {/* Botón reportar falla — solo si turno abierto, elemento activo y sin incidencia */}
                {turnoId && !enMantenimiento && !incAbierta && (
                  <button
                    onClick={() => setFallaTarget(el)}
                    className="shrink-0 flex items-center gap-1 text-xs text-amber-600 font-semibold border border-amber-300 bg-amber-50 rounded-lg px-2.5 py-2 min-h-[36px] active:bg-amber-100"
                  >
                    Reportar falla
                    <ChevronRight size={12} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {fallaTarget && turnoId && (
        <ReportarFallaSheet
          elementoId={fallaTarget.id}
          elementoNombre={fallaTarget.nombre}
          codigoPatrimonial={fallaTarget.codigo_patrimonial}
          turnoId={turnoId}
          onClose={() => setFallaTarget(null)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  )
}
