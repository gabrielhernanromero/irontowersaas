'use client'

import { useState } from 'react'
import { X, Clock, AlertTriangle, TriangleAlert } from 'lucide-react'
import type { LibroNovedad, Incidencia } from '@/types/database'
import IncidenciaDetailSheet from '@/components/libro/IncidenciaDetailSheet'

function formatHora(h: string | null) { return h ? h.slice(0, 5) : '—' }

const TIPO_CONFIG = {
  apertura: { label: 'Apertura de guardia', color: 'text-emerald-600', dot: 'bg-emerald-500' },
  novedad:  { label: 'Novedad',             color: 'text-amber-600',   dot: 'bg-amber-500'   },
  cierre:   { label: 'Cierre de guardia',   color: 'text-brand-ink',   dot: 'bg-gray-500'    },
}

const SEVERIDAD_DOT: Record<string, string> = {
  alto:  'bg-red-600 animate-pulse',
  medio: 'bg-orange-500',
  bajo:  'bg-amber-500',
}

const SEVERIDAD_BORDER: Record<string, string> = {
  alto:  'border-l-red-500',
  medio: 'border-l-amber-500',
  bajo:  'border-l-yellow-400',
}

const SEVERIDAD_BG: Record<string, string> = {
  alto:  'bg-red-50/30',
  medio: 'bg-amber-50/30',
  bajo:  'bg-yellow-50/30',
}

const SEVERIDAD_BADGE: Record<string, { label: string; cls: string }> = {
  alto:  { label: 'Incidencia Crítica',   cls: 'inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10' },
  medio: { label: 'Incidencia — Media',   cls: 'inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/10' },
  bajo:  { label: 'Incidencia — Baja',    cls: 'inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-700 ring-1 ring-inset ring-yellow-600/10' },
}

const SEVERIDAD_CHIP: Record<string, string> = {
  alto:  'bg-red-100 text-red-800 border-red-300',
  medio: 'bg-orange-100 text-orange-800 border-orange-300',
  bajo:  'bg-yellow-100 text-yellow-800 border-yellow-300',
}
const SEVERIDAD_LABEL: Record<string, string> = { alto: 'Alta', medio: 'Media', bajo: 'Baja' }

interface Props {
  novedades: LibroNovedad[]
  incidencias?: Incidencia[]
  turnoId?: string
}

export default function NovedadesTimeline({ novedades, incidencias = [], turnoId }: Props) {
  const [selected, setSelected] = useState<LibroNovedad | null>(null)
  const [selectedIncidencia, setSelectedIncidencia] = useState<Incidencia | null>(null)

  function handleNovedadClick(n: LibroNovedad) {
    const esSeguimiento = !!n.incidencia_id && n.descripcion.startsWith('Seguimiento:')

    if (n.incidencia_id && !esSeguimiento) {
      // Entrada original de incidencia → abrir IncidenciaDetailSheet con datos completos
      const inc = incidencias.find((i) => i.id === n.incidencia_id) ?? (n.incidencias as Incidencia | undefined) ?? null
      if (inc) {
        setSelectedIncidencia(inc)
        return
      }
    }
    // Novedad normal o seguimiento → sheet de detalle simple
    setSelected(n)
  }

  return (
    <>
      <div className="relative">
        <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-200" />
        <div className="flex flex-col gap-4">
          {novedades.map((n) => {
            const cfg           = TIPO_CONFIG[n.tipo]
            const esIncidencia  = !!n.incidencias
            const esSeguimiento = !!n.incidencia_id && n.descripcion.startsWith('Seguimiento:')
            const sev           = n.incidencias?.severidad ?? 'bajo'

            // ── SUB-EVENTO: seguimiento ──────────────────────────
            if (esSeguimiento) {
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setSelected(n)}
                  className="flex gap-4 items-start pl-1 text-left w-full active:opacity-70 ml-4"
                >
                  <div className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 bg-gray-400 ring-2 ring-white" />
                  <div className="flex-1 rounded-xl border border-gray-200 shadow-sm p-2.5 overflow-hidden bg-slate-50">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {n.incidencias?.titulo
                        ? `${n.incidencias.titulo} — Seguimiento`
                        : (incidencias.find(i => i.id === n.incidencia_id)?.titulo
                          ? `${incidencias.find(i => i.id === n.incidencia_id)!.titulo} — Seguimiento`
                          : 'Seguimiento')}
                    </span>
                      <span className="text-xs text-gray-400 shrink-0">{formatHora(n.hora)}</span>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {n.descripcion.replace(/^Seguimiento:\s*/i, '')}
                    </p>
                  </div>
                </button>
              )
            }

            // ── EVENTO NORMAL / INCIDENCIA ───────────────────────
            const dot        = esIncidencia ? (SEVERIDAD_DOT[sev]    ?? 'bg-red-600') : cfg.dot
            const borderLeft = esIncidencia ? `border-l-4 ${SEVERIDAD_BORDER[sev] ?? 'border-l-red-500'}` : ''
            const bgCard     = esIncidencia ? (SEVERIDAD_BG[sev]     ?? 'bg-red-50/30') : 'bg-white'
            const badge      = esIncidencia ? (SEVERIDAD_BADGE[sev]  ?? SEVERIDAD_BADGE.alto) : null

            return (
              <button
                key={n.id}
                type="button"
                onClick={() => handleNovedadClick(n)}
                className="flex gap-4 items-start pl-1 text-left w-full active:opacity-70"
              >
                <div className={`w-3.5 h-3.5 rounded-full shrink-0 mt-1 ${dot} ring-2 ring-white`} />
                <div className={`flex-1 rounded-xl border shadow-sm p-3 overflow-hidden ${bgCard} ${borderLeft} ${
                  esIncidencia ? 'border-gray-200' : 'border-gray-100'
                }`}>
                  <div className="flex items-start justify-between gap-2 mb-1 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {esIncidencia ? (
                        badge && <span className={badge.cls}>{badge.label}</span>
                      ) : (
                        <span className={`text-xs font-semibold uppercase tracking-wide ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{formatHora(n.hora)}</span>
                  </div>

                  {esIncidencia && n.incidencias?.titulo && (
                    <p className="text-sm font-bold text-gray-900 mb-1">{n.incidencias.titulo}</p>
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

      {/* ── IncidenciaDetailSheet (incidencia activa) ─────────── */}
      {selectedIncidencia && (
        <IncidenciaDetailSheet
          incidencia={selectedIncidencia}
          turnoId={turnoId}
          onClose={() => setSelectedIncidencia(null)}
          onResolved={() => setSelectedIncidencia(null)}
        />
      )}

      {/* ── Bottom Sheet detalle simple (novedades / seguimientos) ── */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[60]" onClick={() => setSelected(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-[70] bg-white rounded-t-2xl shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="max-w-[430px] mx-auto">
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>

              <div className="px-4 pb-8">
                <div className="flex items-center justify-between py-3 mb-4 border-b border-gray-100">
                  <div className="flex items-center gap-2 flex-wrap">
                    {selected.incidencias ? (
                      <>
                        <AlertTriangle size={16} className="text-red-500 shrink-0" />
                        <span className="text-sm font-semibold text-red-700">Incidencia persistente</span>
                        {selected.incidencias.severidad && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                            SEVERIDAD_CHIP[selected.incidencias.severidad]
                          }`}>
                            {SEVERIDAD_LABEL[selected.incidencias.severidad]}
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

                {selected.incidencias?.titulo && (
                  <div className="mb-4 p-3 bg-red-50 rounded-xl border border-red-200">
                    <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">Título</p>
                    <p className="text-base font-bold text-red-800">{selected.incidencias.titulo}</p>
                    <div className="flex items-center gap-1 mt-2">
                      <TriangleAlert size={12} className="text-red-400" />
                      <p className="text-xs text-red-600">Esta incidencia persiste en el puesto hasta que sea resuelta.</p>
                    </div>
                  </div>
                )}

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
                    <img src={selected.foto_url} alt="Foto de la novedad" className="w-full rounded-xl object-cover max-h-72" />
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
