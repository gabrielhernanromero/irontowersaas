'use client'

import { useState } from 'react'
import { X, Clock } from 'lucide-react'
import type { LibroNovedad, Incidencia } from '@/types/database'
import IncidenciaDetailSheet from '@/components/libro/IncidenciaDetailSheet'

function formatHora(h: string | null) { return h ? h.slice(0, 5) : '—' }

const TIPO_CONFIG = {
  apertura: { label: 'Apertura de guardia', color: 'text-emerald-600', dot: 'bg-emerald-500' },
  novedad:  { label: 'Novedad',             color: 'text-amber-600',   dot: 'bg-amber-500'   },
  cierre:   { label: 'Cierre de guardia',   color: 'text-brand-ink',   dot: 'bg-gray-500'    },
  alerta:   { label: 'Alerta',              color: 'text-red-600',     dot: 'bg-red-500'     },
}

// ── Parseo estricto por regex ──────────────────────────────────────────────────

type EstiloInventario = 'falla' | 'extravio' | 'seguimiento'

interface ParsedNovedad {
  tipo: string
  equipo: string
  detalle: string
  estilo: EstiloInventario
}

const INVENTARIO_ESTILO: Record<EstiloInventario, {
  dot: string; badge: string; card: string; borderLeft: string
}> = {
  falla: {
    dot:        'bg-amber-500',
    badge:      'px-2 py-0.5 text-xs font-bold rounded-md bg-orange-100 text-orange-800 border border-orange-200',
    card:       'bg-orange-50/40 border-orange-200',
    borderLeft: 'border-l-4 border-l-amber-400',
  },
  extravio: {
    dot:        'bg-red-600 animate-pulse',
    badge:      'px-2 py-0.5 text-xs font-bold rounded-md bg-red-100 text-red-800 border border-red-200',
    card:       'bg-red-50/40 border-red-300',
    borderLeft: 'border-l-4 border-l-red-500',
  },
  seguimiento: {
    dot:        'bg-blue-500',
    badge:      'px-2 py-0.5 text-xs font-bold rounded-md bg-blue-100 text-blue-800 border border-blue-200',
    card:       'bg-blue-50/40 border-blue-200',
    borderLeft: 'border-l-4 border-l-blue-400',
  },
}

function parsearNovedad(texto: string): ParsedNovedad | null {
  const match = texto.match(/^\[(.*?)\]\s*(.*?):\s*(.*)$/)
  if (!match) return null

  const tipo   = match[1].trim()
  const equipo = match[2].trim()
  const detalle = match[3].trim()

  const up = tipo.toUpperCase()
  let estilo: EstiloInventario
  if (up.includes('EXTRAV') || up.includes('FALTANTE') || up.includes('ALERTA')) {
    estilo = 'extravio'
  } else if (up.includes('DESPERFECTO') || up.includes('FALLA') || up.includes('DA') || up.includes('DAÑO')) {
    estilo = 'falla'
  } else if (up.includes('SEGUIMIENTO')) {
    estilo = 'seguimiento'
  } else {
    return null
  }

  return { tipo, equipo, detalle, estilo }
}

// ── Card de inventario ─────────────────────────────────────────────────────────

function NovedadCard({ parsed }: { parsed: ParsedNovedad }) {
  const est = INVENTARIO_ESTILO[parsed.estilo]
  return (
    <div className={`rounded-lg border p-3 mt-1 ${est.card}`}>
      <div className="mb-2">
        <span className={est.badge}>{parsed.tipo}</span>
      </div>
      <p className="text-sm font-semibold text-slate-900 leading-tight">{parsed.equipo}</p>
      {parsed.detalle && (
        <p className="text-sm text-slate-600 mt-1 leading-snug">{parsed.detalle}</p>
      )}
    </div>
  )
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  novedades: LibroNovedad[]
  incidencias?: Incidencia[]
  turnoId?: string
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function NovedadesTimeline({ novedades, incidencias = [], turnoId }: Props) {
  const [selected, setSelected]                     = useState<LibroNovedad | null>(null)
  const [selectedIncidencia, setSelectedIncidencia] = useState<Incidencia | null>(null)
  const [incReadonly, setIncReadonly]               = useState(false)

  function handleNovedadClick(n: LibroNovedad) {
    const esSeguimiento = !!n.incidencia_id && n.descripcion.startsWith('Seguimiento:')

    if (n.incidencia_id && !esSeguimiento) {
      const incActiva  = incidencias.find((i) => i.id === n.incidencia_id)
      const incJoinada = n.incidencias as Incidencia | undefined
      const inc        = incActiva ?? incJoinada ?? null
      if (inc) {
        setIncReadonly(!incActiva && inc.estado === 'resuelto')
        setSelectedIncidencia(inc)
        return
      }
    }

    setSelected(n)
  }

  return (
    <>
      <div className="relative">
        <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-200" />
        <div className="flex flex-col gap-4">
          {novedades.map((n) => {
            const cfg           = TIPO_CONFIG[n.tipo as keyof typeof TIPO_CONFIG] ?? TIPO_CONFIG.novedad
            const esSeguimiento = !!n.incidencia_id && n.descripcion.startsWith('Seguimiento:')
            const parsed        = !esSeguimiento ? parsearNovedad(n.descripcion) : null

            // ── Seguimiento: sub-item indentado ──────────────────────────────
            if (esSeguimiento) {
              const tituloInc = (n.incidencias as Incidencia | undefined)?.titulo
                ?? incidencias.find(i => i.id === n.incidencia_id)?.titulo

              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setSelected(n)}
                  className="flex gap-4 items-start pl-1 text-left w-full active:opacity-70 ml-4"
                >
                  <div className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 bg-gray-400 ring-2 ring-white" />
                  <div className="flex-1 rounded-xl border border-gray-200 shadow-sm p-2.5 bg-slate-50">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {tituloInc ? `${tituloInc} — Seguimiento` : 'Seguimiento'}
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

            // ── Dot: color según parseo, default según tipo ──────────────────
            const dot = parsed ? INVENTARIO_ESTILO[parsed.estilo].dot : cfg.dot

            return (
              <button
                key={n.id}
                type="button"
                onClick={() => handleNovedadClick(n)}
                className="flex gap-4 items-start pl-1 text-left w-full active:opacity-70"
              >
                <div className={`w-3.5 h-3.5 rounded-full shrink-0 mt-1 ${dot} ring-2 ring-white`} />

                <div className={`flex-1 rounded-xl border shadow-sm overflow-hidden p-3 ${
                  parsed
                    ? `${INVENTARIO_ESTILO[parsed.estilo].card} ${INVENTARIO_ESTILO[parsed.estilo].borderLeft}`
                    : 'bg-white border-gray-100'
                }`}>
                  {/* Header: label de tipo + hora */}
                  <div className="flex items-center justify-between gap-2">
                    {!parsed && (
                      <span className={`text-xs font-semibold uppercase tracking-wide ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 shrink-0 ml-auto">{formatHora(n.hora)}</span>
                  </div>

                  {/* Cuerpo: card estructurada o texto plano */}
                  {parsed ? (
                    <NovedadCard parsed={parsed} />
                  ) : (
                    <p className="text-sm text-brand-ink mt-1 line-clamp-2">{n.descripcion}</p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── IncidenciaDetailSheet ────────────────────────────────────────────── */}
      {selectedIncidencia && (
        <IncidenciaDetailSheet
          incidencia={selectedIncidencia}
          turnoId={incReadonly ? undefined : turnoId}
          onClose={() => { setSelectedIncidencia(null); setIncReadonly(false) }}
          onResolved={() => { setSelectedIncidencia(null); setIncReadonly(false) }}
        />
      )}

      {/* ── Bottom Sheet: detalle simple (apertura, cierre, novedad libre) ─── */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[60]" onClick={() => setSelected(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-[70] bg-white rounded-t-2xl shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="max-w-[430px] mx-auto">
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>

              <div className="px-4 pb-8">
                {/* Header del sheet */}
                <div className="flex items-center justify-between py-3 mb-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${TIPO_CONFIG[selected.tipo as keyof typeof TIPO_CONFIG]?.dot ?? 'bg-gray-400'}`} />
                    <span className={`text-sm font-semibold ${TIPO_CONFIG[selected.tipo as keyof typeof TIPO_CONFIG]?.color ?? 'text-gray-600'}`}>
                      {TIPO_CONFIG[selected.tipo as keyof typeof TIPO_CONFIG]?.label ?? 'Novedad'}
                    </span>
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

                {/* Descripción */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Descripción</p>
                  {(() => {
                    const p = parsearNovedad(selected.descripcion)
                    return p
                      ? <NovedadCard parsed={p} />
                      : <p className="text-sm text-brand-ink">{selected.descripcion}</p>
                  })()}
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
