'use client'

import { useEffect, useState } from 'react'
import { X, User, Clock, MapPin, Loader2, BookOpen, ShieldAlert } from 'lucide-react'

interface Novedad {
  id: string
  tipo: string
  hora: string
  descripcion: string
  riesgo_detectado: string | null
  medidas_adoptadas: string | null
  created_at: string
}

interface TurnoDetalle {
  id: string
  folio_numero: number
  fecha: string
  turno: string
  tecnico_nombre: string
  tecnico_dni: string
  horario_inicio: string
  horario_fin: string | null
  estado: string
  clientes: { id: string; nombre_empresa: string } | null
  novedades: Novedad[]
}

interface Props {
  turnoId: string
  onClose: () => void
}

const TIPO_STYLE: Record<string, { dot: string; label: string }> = {
  apertura:  { dot: 'bg-emerald-500', label: 'Apertura' },
  novedad:   { dot: 'bg-blue-500',    label: 'Novedad'  },
  alerta:    { dot: 'bg-red-500',     label: 'Alerta'   },
  cierre:    { dot: 'bg-gray-400',    label: 'Cierre'   },
}

export default function TurnoSheet({ turnoId, onClose }: Props) {
  const [turno,         setTurno]         = useState<TurnoDetalle | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState<string | null>(null)
  const [forceMotivo,   setForceMotivo]   = useState('')
  const [forcingClose,  setForcingClose]  = useState(false)
  const [forceError,    setForceError]    = useState<string | null>(null)

  async function handleForceClose() {
    if (!forceMotivo.trim()) { setForceError('Escribí el motivo'); return }
    setForcingClose(true)
    setForceError(null)
    try {
      const res = await fetch(`/api/supervisor/turno/${turnoId}/force-close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: forceMotivo }),
      })
      const json = await res.json()
      if (!res.ok) { setForceError(json.error ?? 'Error al cerrar'); return }
      setTurno(prev => prev ? { ...prev, estado: 'cerrado' } : prev)
      setForceMotivo('')
    } catch { setForceError('Error de conexión') }
    finally  { setForcingClose(false) }
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res  = await fetch(`/api/supervisor/turno/${turnoId}`)
        const json = await res.json()
        if (!res.ok) { setError(json.error ?? 'Error al cargar el turno'); return }
        setTurno(json.turno)
      } catch { setError('Error de conexión') }
      finally  { setLoading(false) }
    }
    load()
  }, [turnoId])

  const estadoBadge = turno?.estado === 'abierto'
    ? 'bg-emerald-100 text-emerald-700'
    : turno?.estado === 'pendiente_relevo'
    ? 'bg-amber-100 text-amber-700'
    : 'bg-gray-100 text-gray-600'

  const estadoLabel = turno?.estado === 'abierto'
    ? 'Abierto'
    : turno?.estado === 'pendiente_relevo'
    ? 'Pendiente relevo'
    : 'Cerrado'

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
            <BookOpen size={18} className="text-brand-orange" />
            <span className="font-bold text-brand-ink">Detalle del turno</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center h-48">
              <Loader2 size={24} className="animate-spin text-gray-300" />
            </div>
          )}

          {error && (
            <div className="p-5 text-red-600 text-sm">{error}</div>
          )}

          {turno && !loading && (
            <>
              {/* Turno info */}
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">
                      Folio #{turno.folio_numero} · {turno.turno === 'diurno' ? 'Diurno' : 'Nocturno'}
                    </p>
                    <p className="font-bold text-xl text-brand-ink">{turno.tecnico_nombre}</p>
                    <p className="text-sm text-gray-500">DNI {turno.tecnico_dni}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${estadoBadge}`}>
                    {estadoLabel}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {turno.clientes && (
                    <div className="flex items-center gap-2.5 text-sm text-gray-600">
                      <MapPin size={14} className="text-gray-400 shrink-0" />
                      {turno.clientes.nombre_empresa}
                    </div>
                  )}
                  <div className="flex items-center gap-2.5 text-sm text-gray-600">
                    <User size={14} className="text-gray-400 shrink-0" />
                    {turno.fecha}
                  </div>
                  <div className="flex items-center gap-2.5 text-sm text-gray-600">
                    <Clock size={14} className="text-gray-400 shrink-0" />
                    {turno.horario_inicio}
                    {turno.horario_fin ? ` → ${turno.horario_fin}` : ' → en curso'}
                  </div>
                </div>
              </div>

              <div className="h-px bg-gray-100 mx-5" />

              {/* Force-close — solo si está pendiente de relevo */}
              {turno.estado === 'pendiente_relevo' && (
                <div className="p-5 bg-red-50 border-b border-red-100">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldAlert size={16} className="text-red-500 shrink-0" />
                    <p className="text-sm font-semibold text-red-700">Cierre forzado por supervisión</p>
                  </div>
                  <p className="text-xs text-red-600 mb-3">
                    Usá esto solo si el encargado entrante no puede firmar el relevo. Quedará registrado con tu usuario y motivo.
                  </p>
                  <textarea
                    value={forceMotivo}
                    onChange={e => setForceMotivo(e.target.value)}
                    placeholder="Motivo del cierre forzado..."
                    rows={2}
                    className="w-full border border-red-200 rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-red-400 bg-white"
                  />
                  {forceError && <p className="text-xs text-red-600 mt-1">{forceError}</p>}
                  <button
                    onClick={handleForceClose}
                    disabled={forcingClose}
                    className="mt-2 w-full bg-red-600 text-white text-sm font-semibold py-2.5 rounded-lg active:bg-red-700 disabled:opacity-50"
                  >
                    {forcingClose ? 'Cerrando...' : 'Confirmar cierre forzado'}
                  </button>
                </div>
              )}

              {/* Novedades timeline */}
              <div className="p-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
                  Novedades del turno ({turno.novedades.length})
                </p>

                {turno.novedades.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">Sin novedades registradas.</p>
                ) : (
                  <div className="relative">
                    {/* Vertical line */}
                    <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-100" />

                    <div className="space-y-5">
                      {turno.novedades.map(n => {
                        const style = TIPO_STYLE[n.tipo] ?? TIPO_STYLE.novedad
                        return (
                          <div key={n.id} className="relative flex gap-4">
                            {/* Dot */}
                            <div className={`w-3.5 h-3.5 rounded-full ${style.dot} shrink-0 mt-0.5 ring-2 ring-white z-10`} />

                            <div className="flex-1 min-w-0 pb-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold text-gray-500">{n.hora}</span>
                                <span className="text-xs text-gray-400">{style.label}</span>
                              </div>
                              <p className="text-sm text-gray-800 leading-relaxed">{n.descripcion}</p>
                              {n.riesgo_detectado && (
                                <p className="text-xs text-red-600 mt-1">
                                  <span className="font-medium">Riesgo:</span> {n.riesgo_detectado}
                                </p>
                              )}
                              {n.medidas_adoptadas && (
                                <p className="text-xs text-gray-500 mt-0.5">
                                  <span className="font-medium">Medidas:</span> {n.medidas_adoptadas}
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
