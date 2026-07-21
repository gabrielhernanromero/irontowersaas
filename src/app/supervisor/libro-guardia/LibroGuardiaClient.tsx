'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, ChevronRight, Shield } from 'lucide-react'
import ClienteSelector from '../dashboard/components/ClienteSelector'
import TurnoSheet from '../dashboard/components/TurnoSheet'

interface Turno {
  id: string
  folio_numero: number
  fecha: string
  turno: 'diurno' | 'nocturno'
  tecnico_nombre: string
  tecnico_dni: string
  horario_inicio: string
  horario_fin: string | null
  estado: 'abierto' | 'pendiente_relevo' | 'cerrado'
  cliente_id: string | null
  clientes: { id: string; nombre_empresa: string } | null
}

interface Props {
  turnos: Turno[]
  clientes: { id: string; nombre_empresa: string }[]
  clienteId: string | null
  rango: 'hoy' | '7d' | '30d'
}

const ESTADO: Record<Turno['estado'], { label: string; badge: string; dot: string }> = {
  abierto:          { label: 'En vivo',           badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  pendiente_relevo: { label: 'Pendiente relevo',  badge: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-400'   },
  cerrado:          { label: 'Cerrado',           badge: 'bg-gray-100 text-gray-500',       dot: 'bg-gray-400'    },
}

const RANGOS: { key: Props['rango']; label: string }[] = [
  { key: 'hoy', label: 'Hoy' },
  { key: '7d',  label: '7 días' },
  { key: '30d', label: '30 días' },
]

export default function LibroGuardiaClient({ turnos, clientes, clienteId, rango }: Props) {
  const router = useRouter()
  const [turnoSheet, setTurnoSheet] = useState<string | null>(null)

  function actualizarUrl(next: { cliente_id?: string | null; rango?: string }) {
    const params = new URLSearchParams()
    const c = next.cliente_id !== undefined ? next.cliente_id : clienteId
    const r = next.rango ?? rango
    if (c) params.set('cliente_id', c)
    if (r) params.set('rango', r)
    router.push(`/supervisor/libro-guardia?${params.toString()}`)
  }

  const abiertos = turnos.filter(t => t.estado !== 'cerrado').length

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          {RANGOS.map(r => (
            <button
              key={r.key}
              onClick={() => actualizarUrl({ rango: r.key })}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                rango === r.key ? 'bg-brand-ink text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <ClienteSelector clientes={clientes} value={clienteId} onChange={id => actualizarUrl({ cliente_id: id })} />
      </div>

      {/* Resumen rápido */}
      {abiertos > 0 && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          {abiertos} {abiertos === 1 ? 'guardia en vivo ahora' : 'guardias en vivo ahora'}
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {turnos.length === 0 ? (
          <div className="p-10 text-center">
            <Shield size={28} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm text-gray-400">Sin turnos en este período.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {turnos.map(t => {
              const est = ESTADO[t.estado]
              return (
                <button
                  key={t.id}
                  onClick={() => setTurnoSheet(t.id)}
                  className="w-full text-left flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${est.dot}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-brand-ink">{t.tecnico_nombre}</p>
                        <span className="text-xs text-gray-400 font-mono">Folio #{t.folio_numero}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {t.clientes && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <MapPin size={11} className="text-gray-400" />
                            {t.clientes.nombre_empresa}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {t.fecha} · {t.turno === 'diurno' ? 'Diurno' : 'Nocturno'} · {t.horario_inicio}
                          {t.horario_fin ? ` → ${t.horario_fin}` : ' → en curso'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${est.badge}`}>{est.label}</span>
                    <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {turnoSheet && <TurnoSheet turnoId={turnoSheet} onClose={() => setTurnoSheet(null)} />}
    </div>
  )
}
