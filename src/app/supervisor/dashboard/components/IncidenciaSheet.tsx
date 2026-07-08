'use client'

import { useState, useEffect } from 'react'
import {
  X, AlertTriangle, MapPin, Package, Clock,
  CheckCircle, Loader2, MessageSquare, User,
  ShieldCheck, ShieldX, Camera,
} from 'lucide-react'
import FotoLightbox, { FotoThumb } from './FotoLightbox'

interface Incidencia {
  id: string
  titulo: string
  descripcion: string
  severidad: 'bajo' | 'medio' | 'alto' | null
  estado: string
  foto_url: string | null
  requiere_aprobacion: boolean
  estado_aprobacion: 'pendiente_revision' | 'aprobada' | 'rechazada'
  created_at: string
  clientes: { id: string; nombre_empresa: string } | null
  elemento: { id: string; nombre: string; codigo_patrimonial: string } | null
}

interface HistorialItem {
  id: string
  hora: string
  descripcion: string
  created_at: string
  users: { nombre: string; apellido: string } | null
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

function tiempoAbierta(created: string): string {
  const diff = Date.now() - new Date(created).getTime()
  const h    = diff / 3600000
  if (h < 1) return `hace ${Math.floor(h * 60)} min`
  if (h < 24) return `hace ${Math.floor(h)}h`
  const d = Math.floor(h / 24)
  return `hace ${d} día${d !== 1 ? 's' : ''}`
}

export default function IncidenciaSheet({ incidencia, onClose, onResolved }: Props) {
  const [resolving,   setResolving]   = useState(false)
  const [observacion, setObservacion] = useState('')
  const [error,       setError]       = useState<string | null>(null)
  const [resolved,    setResolved]    = useState(false)
  const [historial,   setHistorial]   = useState<HistorialItem[]>([])
  const [loadingHist, setLoadingHist] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const sev = SEV_CONFIG[incidencia.severidad ?? 'bajo']

  // Cargar historial de seguimiento
  useEffect(() => {
    async function load() {
      setLoadingHist(true)
      try {
        const res  = await fetch(`/api/incidencias/historial?id=${incidencia.id}`)
        const data = await res.json()
        if (res.ok && Array.isArray(data)) setHistorial(data)
      } catch { /* silencioso */ }
      finally  { setLoadingHist(false) }
    }
    load()
  }, [incidencia.id])

  async function handleResolver() {
    setResolving(true)
    setError(null)
    try {
      const res = await fetch(`/api/supervisor/incidencias/${incidencia.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observacion: observacion.trim() || undefined }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al resolver'); return }
      setResolved(true)
      onResolved(incidencia.id)
      setTimeout(onClose, 800)
    } catch { setError('Error de conexión') }
    finally  { setResolving(false) }
  }

  const aprobacionBadge =
    incidencia.estado_aprobacion === 'pendiente_revision' ? { cls: 'bg-orange-100 text-orange-700', label: 'Pendiente de aprobación del encargado' } :
    incidencia.estado_aprobacion === 'aprobada'           ? { cls: 'bg-emerald-100 text-emerald-700', label: 'Aprobada por encargado' } :
    incidencia.estado_aprobacion === 'rechazada'          ? { cls: 'bg-red-100 text-red-700', label: 'Rechazada por encargado' } :
    null

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />

      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-brand-orange" />
            <span className="font-bold text-brand-ink">Incidencia</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
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

          {/* Foto principal de la incidencia */}
          {incidencia.foto_url && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Camera size={12} />
                Foto de la incidencia
              </p>
              <FotoThumb
                url={incidencia.foto_url}
                onClick={() => setLightboxUrl(incidencia.foto_url!)}
                className="w-full h-48"
              />
            </div>
          )}

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
              Abierta {tiempoAbierta(incidencia.created_at)}
            </div>
          </div>

          {/* Estado de aprobación (solo informativo para el supervisor) */}
          {incidencia.requiere_aprobacion && aprobacionBadge && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold ${aprobacionBadge.cls}`}>
              {incidencia.estado_aprobacion === 'aprobada'  && <ShieldCheck size={14} />}
              {incidencia.estado_aprobacion === 'rechazada' && <ShieldX     size={14} />}
              {incidencia.estado_aprobacion === 'pendiente_revision' && <Clock size={14} />}
              {aprobacionBadge.label}
            </div>
          )}

          {/* Description */}
          {incidencia.descripcion && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Descripción</p>
              <p className="text-sm text-gray-700 leading-relaxed">{incidencia.descripcion}</p>
            </div>
          )}

          {/* Historial de seguimiento */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <MessageSquare size={12} />
              Historial de seguimiento
            </p>

            {loadingHist ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
                <Loader2 size={14} className="animate-spin" />
                Cargando...
              </div>
            ) : historial.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Sin seguimiento registrado.</p>
            ) : (
              <div className="relative">
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-100" />
                <div className="space-y-4">
                  {historial.map(h => (
                    <div key={h.id} className="relative flex gap-4">
                      <div className="w-3.5 h-3.5 rounded-full bg-blue-400 shrink-0 mt-0.5 ring-2 ring-white z-10" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-gray-500">{h.hora}</span>
                          {h.users && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <User size={10} />
                              {h.users.nombre} {h.users.apellido}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">{h.descripcion}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="h-px bg-gray-100" />

          {/* Resolve action */}
          {resolved ? (
            <div className="flex items-center gap-2.5 text-emerald-600 font-semibold">
              <CheckCircle size={18} />
              Incidencia resuelta
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                Acción del supervisor
              </p>
              <textarea
                value={observacion}
                onChange={e => setObservacion(e.target.value)}
                placeholder="Observación de resolución (opcional)..."
                rows={2}
                className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-brand-ink/30 bg-white"
              />
              <button
                onClick={handleResolver}
                disabled={resolving}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-3 rounded-xl text-sm disabled:opacity-60 transition-colors min-h-[48px]"
              >
                {resolving
                  ? <><Loader2 size={15} className="animate-spin" /> Resolviendo...</>
                  : <><CheckCircle size={15} /> Marcar como resuelta</>
                }
              </button>
              {error && <p className="text-red-600 text-sm">{error}</p>}
            </div>
          )}
        </div>
      </div>

      {lightboxUrl && (
        <FotoLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}
    </>
  )
}
