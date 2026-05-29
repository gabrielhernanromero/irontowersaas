'use client'

import { useState } from 'react'
import { X, AlertTriangle, MapPin, Package, Clock, CheckCircle, Loader2 } from 'lucide-react'

interface Incidencia {
  id: string
  titulo: string
  descripcion: string
  severidad: 'bajo' | 'medio' | 'alto' | null
  estado: string
  created_at: string
  clientes: { id: string; nombre_empresa: string } | null
  elemento: { id: string; nombre: string; codigo_patrimonial: string } | null
}

interface Props {
  incidencia: Incidencia
  onClose: () => void
  onResolved: (id: string) => void
}

const SEV_CONFIG = {
  alto:  { label: 'Alto',  bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    dot: 'bg-red-500'   },
  medio: { label: 'Medio', bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  dot: 'bg-amber-400' },
  bajo:  { label: 'Bajo',  bg: 'bg-gray-50',   text: 'text-gray-600',   border: 'border-gray-200',   dot: 'bg-gray-400'  },
} as const

function diasAbierta(created: string): string {
  const diff = Date.now() - new Date(created).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Abierta hoy'
  if (days === 1) return 'Abierta hace 1 día'
  return `Abierta hace ${days} días`
}

export default function IncidenciaSheet({ incidencia, onClose, onResolved }: Props) {
  const [resolving, setResolving] = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [resolved,  setResolved]  = useState(false)

  const sev = SEV_CONFIG[incidencia.severidad ?? 'bajo']

  async function handleResolver() {
    setResolving(true)
    setError(null)
    try {
      const res = await fetch(`/api/supervisor/incidencias/${incidencia.id}`, {
        method: 'PATCH',
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al resolver'); return }
      setResolved(true)
      onResolved(incidencia.id)
      setTimeout(onClose, 800)
    } catch { setError('Error de conexión') }
    finally  { setResolving(false) }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-brand-orange" />
            <span className="font-bold text-brand-ink">Incidencia</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Severity + Title */}
          <div className={`rounded-xl p-4 ${sev.bg} border ${sev.border}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2 h-2 rounded-full ${sev.dot}`} />
              <span className={`text-xs font-bold uppercase tracking-wide ${sev.text}`}>
                Severidad {sev.label}
              </span>
            </div>
            <p className="font-bold text-brand-ink text-lg leading-snug">{incidencia.titulo}</p>
          </div>

          {/* Meta info */}
          <div className="space-y-2.5">
            {incidencia.clientes && (
              <div className="flex items-center gap-2.5 text-sm text-gray-600">
                <MapPin size={14} className="text-gray-400 shrink-0" />
                {incidencia.clientes.nombre_empresa}
              </div>
            )}
            {incidencia.elemento && (
              <div className="flex items-center gap-2.5 text-sm text-gray-600">
                <Package size={14} className="text-gray-400 shrink-0" />
                {incidencia.elemento.nombre}
                <span className="text-gray-400 text-xs">({incidencia.elemento.codigo_patrimonial})</span>
              </div>
            )}
            <div className="flex items-center gap-2.5 text-sm text-gray-500">
              <Clock size={14} className="text-gray-400 shrink-0" />
              {diasAbierta(incidencia.created_at)}
            </div>
          </div>

          {/* Description */}
          {incidencia.descripcion && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Descripción</p>
              <p className="text-sm text-gray-700 leading-relaxed">{incidencia.descripcion}</p>
            </div>
          )}

          <div className="h-px bg-gray-100" />

          {/* Resolve action */}
          {resolved ? (
            <div className="flex items-center gap-2.5 text-emerald-600 font-semibold">
              <CheckCircle size={18} />
              Incidencia resuelta
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                Acción del supervisor
              </p>
              <button
                onClick={handleResolver}
                disabled={resolving}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm disabled:opacity-60 transition-colors"
              >
                {resolving
                  ? <><Loader2 size={15} className="animate-spin" /> Resolviendo...</>
                  : <><CheckCircle size={15} /> Marcar como resuelta</>
                }
              </button>
              {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
