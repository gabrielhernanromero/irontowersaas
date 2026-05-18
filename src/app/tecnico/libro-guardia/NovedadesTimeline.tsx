'use client'

import { useState } from 'react'
import { X, Clock, AlertTriangle, TriangleAlert } from 'lucide-react'
import type { LibroNovedad } from '@/types/database'

function formatHora(h: string | null) { return h ? h.slice(0, 5) : '—' }

const TIPO_CONFIG = {
  apertura: { label: 'Apertura de guardia', color: 'text-green-600',  dot: 'bg-green-500'  },
  novedad:  { label: 'Novedad',             color: 'text-amber-600',  dot: 'bg-amber-500'  },
  cierre:   { label: 'Cierre de guardia',   color: 'text-brand-ink',  dot: 'bg-gray-500'   },
}

const SEVERIDAD_CONFIG = {
  bajo:  { label: 'Baja',  color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  medio: { label: 'Media', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  alto:  { label: 'Alta',  color: 'bg-red-100 text-red-800 border-red-300'          },
}

export default function NovedadesTimeline({ novedades }: { novedades: LibroNovedad[] }) {
  const [selected, setSelected] = useState<LibroNovedad | null>(null)

  return (
    <>
      <div className="relative">
        <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-200" />
        <div className="flex flex-col gap-4">
          {novedades.map((n) => {
            const cfg = TIPO_CONFIG[n.tipo]
            const esIncidencia = !!n.incidencias
            const dot = esIncidencia ? 'bg-red-500' : cfg.dot

            return (
              <button
                key={n.id}
                type="button"
                onClick={() => setSelected(n)}
                className="flex gap-4 items-start pl-1 text-left w-full active:opacity-70"
              >
                <div className={`w-3.5 h-3.5 rounded-full shrink-0 mt-1 ${dot} ring-2 ring-white`} />
                <div className={`flex-1 rounded-xl border p-3 shadow-sm ${
                  esIncidencia
                    ? 'bg-red-50 border-red-200'
                    : 'bg-white border-gray-100'
                }`}>
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold uppercase tracking-wide ${
                        esIncidencia ? 'text-red-600' : cfg.color
                      }`}>
                        {esIncidencia ? 'Incidencia' : cfg.label}
                      </span>
                      {esIncidencia && n.incidencias?.severidad && (
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${
                          SEVERIDAD_CONFIG[n.incidencias.severidad].color
                        }`}>
                          {SEVERIDAD_CONFIG[n.incidencias.severidad].label}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{formatHora(n.hora)}</span>
                  </div>

                  {esIncidencia && n.incidencias?.titulo && (
                    <p className="text-sm font-semibold text-red-800 mb-1">{n.incidencias.titulo}</p>
                  )}

                  <p className="text-sm text-brand-ink line-clamp-2">{n.descripcion}</p>

                  {esIncidencia && (
                    <div className="flex items-center gap-1 mt-2">
                      <AlertTriangle size={11} className="text-red-500 shrink-0" />
                      <span className="text-xs text-red-600 font-medium">Persiste en el puesto</span>
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Bottom sheet — z-[70] para cubrir el action bar (z-50) */}
      {selected && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-[60]"
            onClick={() => setSelected(null)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-[70] bg-white rounded-t-2xl shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="max-w-[430px] mx-auto">
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>

              <div className="px-4 pb-8">
                {/* Header */}
                <div className="flex items-center justify-between py-3 mb-4 border-b border-gray-100">
                  <div className="flex items-center gap-2 flex-wrap">
                    {selected.incidencias ? (
                      <>
                        <AlertTriangle size={16} className="text-red-500 shrink-0" />
                        <span className="text-sm font-semibold text-red-700">Incidencia persistente</span>
                        {selected.incidencias.severidad && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                            SEVERIDAD_CONFIG[selected.incidencias.severidad].color
                          }`}>
                            {SEVERIDAD_CONFIG[selected.incidencias.severidad].label}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <div className={`w-2.5 h-2.5 rounded-full ${TIPO_CONFIG[selected.tipo].dot}`} />
                        <span className={`text-sm font-semibold ${TIPO_CONFIG[selected.tipo].color}`}>
                          {TIPO_CONFIG[selected.tipo].label}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock size={12} />
                      {formatHora(selected.hora)}
                    </div>
                    <button
                      onClick={() => setSelected(null)}
                      className="p-1 text-gray-400 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Título de incidencia */}
                {selected.incidencias?.titulo && (
                  <div className="mb-4 p-3 bg-red-50 rounded-xl border border-red-200">
                    <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">Título</p>
                    <p className="text-base font-bold text-red-800">{selected.incidencias.titulo}</p>
                    <div className="flex items-center gap-1 mt-2">
                      <TriangleAlert size={12} className="text-red-400" />
                      <p className="text-xs text-red-600">Esta incidencia persiste en el puesto hasta que sea resuelta por el supervisor.</p>
                    </div>
                  </div>
                )}

                {/* Descripción */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Descripción</p>
                  <p className="text-sm text-brand-ink">{selected.descripcion}</p>
                </div>

                {selected.riesgo_detectado && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Riesgo detectado</p>
                    <p className="text-sm text-brand-ink">{selected.riesgo_detectado}</p>
                  </div>
                )}

                {selected.medidas_adoptadas && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Medidas adoptadas</p>
                    <p className="text-sm text-brand-ink">{selected.medidas_adoptadas}</p>
                  </div>
                )}

                {selected.observaciones_generales && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Observaciones</p>
                    <p className="text-sm text-brand-ink">{selected.observaciones_generales}</p>
                  </div>
                )}

                {selected.foto_url && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Foto</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selected.foto_url}
                      alt="Foto de la novedad"
                      className="w-full rounded-xl object-cover max-h-72"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
