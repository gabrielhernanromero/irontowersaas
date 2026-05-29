'use client'

import { useState, useMemo } from 'react'
import { CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, Building2, QrCode } from 'lucide-react'

interface Scan {
  id: string
  punto_control_id: string
  escaneado_at: string
  puntos_control: { id: string; nombre: string; ubicacion: string | null } | null
}

interface Ronda {
  id: string
  turno_id: string | null
  cliente_id: string
  numero_ronda: number
  hora_inicio: string
  hora_fin: string | null
  total_puntos: number
  puntos_escaneados: number
  completa: boolean
  clientes: { id: string; nombre_empresa: string } | null
  ronda_scans: Scan[]
}

interface Props {
  initialRondas: Ronda[]
  clientes: { id: string; nombre_empresa: string }[]
}

function pct(escaneados: number, total: number) {
  if (total === 0) return 0
  return Math.round((escaneados / total) * 100)
}

function duracion(inicio: string, fin: string | null): string {
  if (!fin) return 'En curso'
  const mins = Math.round((new Date(fin).getTime() - new Date(inicio).getTime()) / 60000)
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}min`
}

function formatHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

export default function RondasSupervisorClient({ initialRondas, clientes }: Props) {
  const [rondas]             = useState(initialRondas)
  const [clienteId,  setClienteId]  = useState<string>('all')
  const [soloIncompletas, setSoloIncompletas] = useState(false)
  const [expanded,   setExpanded]   = useState<string | null>(null)

  const filtradas = useMemo(() => {
    let r = rondas
    if (clienteId !== 'all') r = r.filter(x => x.cliente_id === clienteId)
    if (soloIncompletas)     r = r.filter(x => !x.completa)
    return r
  }, [rondas, clienteId, soloIncompletas])

  // KPIs globales (filtrados)
  const kpis = useMemo(() => {
    const total     = filtradas.length
    const completas = filtradas.filter(r => r.completa).length
    const cumplimiento = total === 0 ? 0 : Math.round(
      filtradas.reduce((acc, r) => acc + pct(r.puntos_escaneados, r.total_puntos), 0) / total
    )
    return { total, completas, incompletas: total - completas, cumplimiento }
  }, [filtradas])

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={clienteId}
          onChange={e => setClienteId(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white shadow-sm"
        >
          <option value="all">Todos los clientes</option>
          {clientes.map(c => (
            <option key={c.id} value={c.id}>{c.nombre_empresa}</option>
          ))}
        </select>

        <button
          onClick={() => setSoloIncompletas(p => !p)}
          className={`text-xs px-3 py-2 rounded-xl border transition-colors ${
            soloIncompletas ? 'bg-red-50 border-red-200 text-red-700 font-semibold' : 'border-gray-200 text-gray-500'
          }`}
        >
          Solo incompletas
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total rondas',     value: kpis.total,        color: 'text-gray-700'     },
          { label: 'Completas',        value: kpis.completas,    color: 'text-emerald-600'  },
          { label: 'Incompletas',      value: kpis.incompletas,  color: 'text-red-500'      },
          { label: '% Cumplimiento',   value: `${kpis.cumplimiento}%`, color: kpis.cumplimiento >= 90 ? 'text-emerald-600' : kpis.cumplimiento >= 70 ? 'text-amber-500' : 'text-red-500' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className={`text-3xl font-black ${k.color}`}>{k.value}</p>
            <p className="text-sm text-gray-500 mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Lista de rondas */}
      {filtradas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <QrCode size={28} className="mx-auto mb-3 text-gray-200" />
          <p className="text-sm text-gray-400">Sin rondas en el período seleccionado</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_120px_100px_100px_80px_40px] px-4 py-3 bg-gray-50 border-b border-gray-100">
            {['Cliente / Turno', 'Fecha', 'Duración', 'Cumplimiento', 'Estado', ''].map(h => (
              <span key={h} className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</span>
            ))}
          </div>

          <div className="divide-y divide-gray-50">
            {filtradas.map(ronda => {
              const p       = pct(ronda.puntos_escaneados, ronda.total_puntos)
              const isOpen  = expanded === ronda.id
              const barColor = p >= 90 ? 'bg-emerald-500' : p >= 70 ? 'bg-amber-400' : 'bg-red-500'

              return (
                <div key={ronda.id}>
                  <div
                    className="grid grid-cols-[1fr_120px_100px_100px_80px_40px] px-4 py-3.5 items-center hover:bg-gray-50/50 cursor-pointer transition-colors"
                    onClick={() => setExpanded(isOpen ? null : ronda.id)}
                  >
                    {/* Cliente + ronda # */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Building2 size={12} className="text-gray-400 shrink-0" />
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {ronda.clientes?.nombre_empresa ?? '—'}
                        </p>
                        <span className="text-xs text-gray-400 shrink-0">Ronda #{ronda.numero_ronda}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 ml-4">
                        {formatHora(ronda.hora_inicio)}{ronda.hora_fin ? ` → ${formatHora(ronda.hora_fin)}` : ' → en curso'}
                      </p>
                    </div>

                    {/* Fecha */}
                    <span className="text-sm text-gray-600">{formatFecha(ronda.hora_inicio)}</span>

                    {/* Duración */}
                    <span className="flex items-center gap-1 text-sm text-gray-600">
                      <Clock size={12} className="text-gray-400" />
                      {duracion(ronda.hora_inicio, ronda.hora_fin)}
                    </span>

                    {/* Barra de cumplimiento */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-700">{p}%</span>
                        <span className="text-xs text-gray-400">{ronda.puntos_escaneados}/{ronda.total_puntos}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full transition-all ${barColor}`} style={{ width: `${p}%` }} />
                      </div>
                    </div>

                    {/* Estado */}
                    <div>
                      {ronda.completa
                        ? <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600"><CheckCircle size={12} /> Completa</span>
                        : ronda.hora_fin
                          ? <span className="flex items-center gap-1 text-xs font-semibold text-red-500"><XCircle size={12} /> Incompleta</span>
                          : <span className="flex items-center gap-1 text-xs font-semibold text-amber-600"><Clock size={12} /> En curso</span>
                      }
                    </div>

                    {/* Expand */}
                    <div className="flex justify-end">
                      {isOpen ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
                    </div>
                  </div>

                  {/* Detalle de scans */}
                  {isOpen && (
                    <div className="px-4 pb-4 pt-2 bg-gray-50/50 border-t border-gray-50">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                        Detalle de escaneos
                      </p>
                      {ronda.ronda_scans.length === 0 ? (
                        <p className="text-sm text-gray-400 italic">Sin escaneos registrados.</p>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {ronda.ronda_scans.map((scan, i) => (
                            <div key={scan.id} className="bg-white rounded-lg border border-gray-100 p-2.5 flex items-center gap-2">
                              <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-gray-700 truncate">
                                  {scan.puntos_control?.nombre ?? `Punto ${i + 1}`}
                                </p>
                                <p className="text-xs text-gray-400">{formatHora(scan.escaneado_at)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
