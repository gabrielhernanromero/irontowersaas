'use client'

import { useEffect, useState } from 'react'
import {
  X, User, Clock, MapPin, Loader2, BookOpen, ShieldAlert,
  ClipboardCheck, CheckCircle2, CheckCircle, XCircle, Camera,
} from 'lucide-react'
import FotoLightbox, { FotoThumb } from './FotoLightbox'

interface Novedad {
  id: string
  tipo: string
  hora: string
  descripcion: string
  riesgo_detectado: string | null
  medidas_adoptadas: string | null
  foto_url: string | null
  created_at: string
}

interface PuntoControl {
  id: string
  nombre: string
  ubicacion: string | null
}

interface RondaScan {
  id: string
  punto_control_id: string
  escaneado_at: string
  novedad_id: string | null
  foto_url: string | null
  puntos_control: PuntoControl | null
}

interface Ronda {
  id: string
  numero_ronda: number
  hora_inicio: string
  hora_fin: string | null
  total_puntos: number
  puntos_escaneados: number
  completa: boolean
  ronda_scans: RondaScan[]
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

type Tab = 'novedades' | 'rondas'

const TIPO_STYLE: Record<string, { dot: string; label: string }> = {
  apertura:  { dot: 'bg-emerald-500', label: 'Apertura' },
  novedad:   { dot: 'bg-blue-500',    label: 'Novedad'  },
  alerta:    { dot: 'bg-red-500',     label: 'Alerta'   },
  cierre:    { dot: 'bg-gray-400',    label: 'Cierre'   },
  ronda:     { dot: 'bg-purple-500',  label: 'Ronda'    },
  sistema:   { dot: 'bg-gray-300',    label: 'Sistema'  },
}

export default function TurnoSheet({ turnoId, onClose }: Props) {
  const [turno,        setTurno]        = useState<TurnoDetalle | null>(null)
  const [rondas,       setRondas]       = useState<Ronda[]>([])
  const [loading,      setLoading]      = useState(true)
  const [loadingRondas,setLoadingRondas]= useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [tab,          setTab]          = useState<Tab>('novedades')
  const [forceMotivo,  setForceMotivo]  = useState('')
  const [forcingClose, setForcingClose] = useState(false)
  const [forceError,   setForceError]   = useState<string | null>(null)
  const [lightboxUrl,  setLightboxUrl]  = useState<string | null>(null)

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
      setTurno(prev => prev ? { ...prev, estado: json.nuevoEstado ?? 'cerrado' } : prev)
      setForceMotivo('')
    } catch { setForceError('Error de conexión') }
    finally  { setForcingClose(false) }
  }

  // Cargar turno
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

  // Cargar rondas al cambiar de tab
  useEffect(() => {
    if (tab !== 'rondas') return
    async function loadRondas() {
      setLoadingRondas(true)
      try {
        const res  = await fetch(`/api/supervisor/rondas?turno_id=${turnoId}`)
        const json = await res.json()
        if (res.ok) setRondas(json.rondas ?? [])
      } catch { /* silencioso */ }
      finally  { setLoadingRondas(false) }
    }
    loadRondas()
  }, [tab, turnoId])

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

  const novedadesConFoto = turno?.novedades.filter(n => n.foto_url).length ?? 0

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />

      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-brand-orange" />
            <span className="font-bold text-brand-ink">Detalle del turno</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
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
          {error && <div className="p-5 text-red-600 text-sm">{error}</div>}

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

              {/* Force-close */}
              {turno.estado === 'abierto' && (
                <div className="p-5 bg-amber-50 border-b border-amber-100">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldAlert size={16} className="text-amber-600 shrink-0" />
                    <p className="text-sm font-semibold text-amber-700">Turno sin cerrar</p>
                  </div>
                  <p className="text-xs text-amber-700 mb-3">
                    El encargado no cerró su turno. Al forzar el cierre quedará <strong>pendiente de relevo</strong>.
                  </p>
                  <textarea
                    value={forceMotivo}
                    onChange={e => setForceMotivo(e.target.value)}
                    placeholder="Motivo del cierre forzado..."
                    rows={2}
                    className="w-full border border-amber-200 rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
                  />
                  {forceError && <p className="text-xs text-red-600 mt-1">{forceError}</p>}
                  <button
                    onClick={handleForceClose}
                    disabled={forcingClose}
                    className="mt-2 w-full bg-amber-600 text-white text-sm font-semibold py-2.5 rounded-lg active:bg-amber-700 disabled:opacity-50 min-h-[44px]"
                  >
                    {forcingClose ? 'Cerrando...' : 'Cerrar y dejar pendiente de relevo'}
                  </button>
                </div>
              )}

              {turno.estado === 'pendiente_relevo' && (
                <div className="p-5 bg-red-50 border-b border-red-100">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldAlert size={16} className="text-red-500 shrink-0" />
                    <p className="text-sm font-semibold text-red-700">Cierre forzado por supervisión</p>
                  </div>
                  <p className="text-xs text-red-600 mb-3">
                    Usá esto solo si el encargado entrante no puede firmar el relevo.
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
                    className="mt-2 w-full bg-red-600 text-white text-sm font-semibold py-2.5 rounded-lg active:bg-red-700 disabled:opacity-50 min-h-[44px]"
                  >
                    {forcingClose ? 'Cerrando...' : 'Confirmar cierre forzado'}
                  </button>
                </div>
              )}

              {/* Tabs */}
              <div className="flex border-b border-gray-100 px-5 gap-1 mt-2">
                <TabBtn active={tab === 'novedades'} onClick={() => setTab('novedades')}>
                  Novedades ({turno.novedades.length})
                  {novedadesConFoto > 0 && (
                    <span className="flex items-center gap-0.5 text-gray-400">
                      <Camera size={11} /> {novedadesConFoto}
                    </span>
                  )}
                </TabBtn>
                <TabBtn active={tab === 'rondas'} onClick={() => setTab('rondas')}>
                  <ClipboardCheck size={13} />
                  Rondas
                </TabBtn>
              </div>

              {/* Tab: Novedades */}
              {tab === 'novedades' && (
                <div className="p-5">
                  {turno.novedades.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">Sin novedades registradas.</p>
                  ) : (
                    <div className="relative">
                      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-100" />
                      <div className="space-y-5">
                        {turno.novedades.map(n => {
                          const style = TIPO_STYLE[n.tipo] ?? TIPO_STYLE.novedad
                          return (
                            <div key={n.id} className="relative flex gap-4">
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
                                {/* Foto de la novedad */}
                                {n.foto_url && (
                                  <FotoThumb
                                    url={n.foto_url}
                                    onClick={() => setLightboxUrl(n.foto_url!)}
                                    className="w-32 h-24 mt-2"
                                  />
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Rondas */}
              {tab === 'rondas' && (
                <div className="p-5 space-y-4">
                  {loadingRondas ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 size={20} className="animate-spin text-gray-300" />
                    </div>
                  ) : rondas.length === 0 ? (
                    <div className="text-center py-6">
                      <ClipboardCheck size={24} className="mx-auto mb-2 text-gray-200" />
                      <p className="text-sm text-gray-400">Sin rondas en este turno</p>
                    </div>
                  ) : (
                    rondas.map(ronda => (
                      <RondaCard
                        key={ronda.id}
                        ronda={ronda}
                        onFoto={setLightboxUrl}
                      />
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {lightboxUrl && (
        <FotoLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TabBtn({ active, onClick, children }: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-brand-ink text-brand-ink'
          : 'border-transparent text-gray-400 hover:text-gray-600'
      }`}
    >
      {children}
    </button>
  )
}

function RondaCard({ ronda, onFoto }: { ronda: Ronda; onFoto: (url: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const pct = ronda.total_puntos > 0
    ? Math.round((ronda.puntos_escaneados / ronda.total_puntos) * 100)
    : 0

  function formatHora(iso: string) {
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          {ronda.completa
            ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            : <XCircle      size={16} className="text-gray-300 shrink-0" />
          }
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800">
              Ronda #{ronda.numero_ronda}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {formatHora(ronda.hora_inicio)}
              {ronda.hora_fin ? ` → ${formatHora(ronda.hora_fin)}` : ' → en curso'}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-sm font-bold ${ronda.completa ? 'text-emerald-600' : 'text-gray-500'}`}>
            {ronda.puntos_escaneados}/{ronda.total_puntos}
          </p>
          <p className="text-xs text-gray-400">{pct}%</p>
        </div>
      </button>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div
          className={`h-full ${ronda.completa ? 'bg-emerald-400' : 'bg-amber-300'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Puntos escaneados (expandible) */}
      {expanded && (
        <div className="divide-y divide-gray-50 bg-gray-50/50">
          {ronda.ronda_scans.map(scan => (
            <div key={scan.id} className="flex items-start gap-3 px-4 py-2.5">
              <CheckCircle size={13} className="text-emerald-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700">
                  {scan.puntos_control?.nombre ?? 'Punto desconocido'}
                </p>
                {scan.puntos_control?.ubicacion && (
                  <p className="text-xs text-gray-400">{scan.puntos_control.ubicacion}</p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(scan.escaneado_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
              </div>
              {scan.foto_url && (
                <FotoThumb
                  url={scan.foto_url}
                  onClick={() => onFoto(scan.foto_url!)}
                  className="w-14 h-14 shrink-0"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
