'use client'

import { useEffect, useState } from 'react'
import {
  X, User, Clock, MapPin, Loader2, BookOpen, ShieldAlert,
  ClipboardCheck, CheckCircle2, CheckCircle, XCircle, Camera,
  AlertTriangle, Package, Phone, Users, FileText, Circle, Navigation,
} from 'lucide-react'
import FotoLightbox, { FotoThumb } from './FotoLightbox'
import { evaluarGeocerca, type EstadoGeocerca } from '@/lib/gps/geocerca'

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

interface IncidenciaTurno {
  id: string
  titulo: string
  descripcion: string
  severidad: 'bajo' | 'medio' | 'alto' | null
  estado: 'abierto' | 'resuelto' | 'cerrado' | 'en_seguimiento'
  foto_url: string | null
  turno_creacion_id: string | null
  created_at: string
}

interface ElementoTurno {
  id: string
  nombre: string
  codigo_patrimonial: string
  categoria: string | null
  estado_admin: 'activo' | 'en_mantenimiento' | 'inactivo'
  auditado: boolean
  estado_operativo: 'ok' | 'falla' | 'faltante' | null
  observacion: string | null
}

interface Participante {
  id: string
  usuario_id: string
  joined_at: string
  users: { nombre: string; apellido: string; dni: string | null; telefono: string | null } | null
}

interface PlanillaChecklistItem {
  nombre: string
  slug: string
  enviada: boolean
  planillaId: string | null
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
  clientes: { id: string; nombre_empresa: string; latitud: number | null; longitud: number | null } | null
  novedades: Novedad[]
  incidencias: IncidenciaTurno[]
  elementos: ElementoTurno[]
  participantes: Participante[]
  encargado_telefono: string | null
  planillasChecklist: PlanillaChecklistItem[]
  apertura_latitud: number | null
  apertura_longitud: number | null
  apertura_precision_m: number | null
  apertura_gps_capturado_at: string | null
  cierre_latitud: number | null
  cierre_longitud: number | null
  cierre_precision_m: number | null
  cierre_gps_capturado_at: string | null
  relevo_latitud: number | null
  relevo_longitud: number | null
  relevo_precision_m: number | null
  relevo_gps_capturado_at: string | null
  relevo_nombre: string | null
  relevo_dni: string | null
}

const GEOCERCA_BADGE: Record<EstadoGeocerca, string> = {
  normal:     'bg-emerald-100 text-emerald-700',
  excepcion:  'bg-amber-100 text-amber-700',
  alerta:     'bg-red-100 text-red-700',
  sin_datos:  'bg-gray-100 text-gray-500',
}

interface GpsEvento {
  label: string
  lat: number | null
  lon: number | null
  capturadoAt: string | null
}

function GpsRow({ evento, cliente }: { evento: GpsEvento; cliente: { latitud: number | null; longitud: number | null } | null }) {
  const { distanciaM, estado } = evaluarGeocerca(
    { lat: evento.lat, lon: evento.lon },
    { lat: cliente?.latitud ?? null, lon: cliente?.longitud ?? null }
  )
  const hora = evento.capturadoAt
    ? new Date(evento.capturadoAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm text-gray-600 shrink-0">{evento.label}</span>
        {hora && <span className="text-xs text-gray-400 shrink-0">{hora}</span>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${GEOCERCA_BADGE[estado]}`}>
          {estado === 'sin_datos'
            ? 'Sin datos GPS'
            : `${estado === 'alerta' ? '⚠ ' : ''}A ${Math.round(distanciaM ?? 0)}m de la sede`}
        </span>
        {evento.lat !== null && evento.lon !== null && (
          <a
            href={`https://www.google.com/maps?q=${evento.lat},${evento.lon}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-brand-orange p-1 -m-1"
            aria-label={`Ver ${evento.label.toLowerCase()} en el mapa`}
          >
            <Navigation size={14} />
          </a>
        )}
      </div>
    </div>
  )
}

interface Props {
  turnoId: string
  onClose: () => void
}

type Tab = 'novedades' | 'rondas' | 'incidencias' | 'elementos'

const SEV_CONFIG: Record<'bajo' | 'medio' | 'alto', { label: string; badge: string }> = {
  alto:  { label: 'Alto',  badge: 'bg-red-100 text-red-700'   },
  medio: { label: 'Medio', badge: 'bg-amber-100 text-amber-700' },
  bajo:  { label: 'Bajo',  badge: 'bg-gray-100 text-gray-600'  },
}

const ESTADO_INCIDENCIA: Record<IncidenciaTurno['estado'], { label: string; badge: string }> = {
  abierto:        { label: 'Abierta',        badge: 'bg-red-100 text-red-700' },
  en_seguimiento: { label: 'En seguimiento',  badge: 'bg-amber-100 text-amber-700' },
  resuelto:       { label: 'Resuelta',        badge: 'bg-emerald-100 text-emerald-700' },
  cerrado:        { label: 'Cerrada',         badge: 'bg-gray-100 text-gray-500' },
}

const ESTADO_ELEMENTO: Record<'ok' | 'falla' | 'faltante', { label: string; badge: string }> = {
  ok:       { label: 'OK',       badge: 'bg-emerald-100 text-emerald-700' },
  falla:    { label: 'Falla',    badge: 'bg-amber-100 text-amber-700' },
  faltante: { label: 'Faltante', badge: 'bg-red-100 text-red-700' },
}

const TIPO_STYLE: Record<string, { dot: string; label: string }> = {
  apertura:  { dot: 'bg-emerald-500', label: 'Apertura' },
  novedad:   { dot: 'bg-blue-500',    label: 'Novedad'  },
  alerta:    { dot: 'bg-red-500',     label: 'Alerta'   },
  cierre:    { dot: 'bg-gray-400',    label: 'Cierre'   },
  ronda:     { dot: 'bg-purple-500',  label: 'Ronda'    },
  sistema:   { dot: 'bg-gray-300',    label: 'Sistema'  },
}

// Novedades generadas por el sistema (planilla con NO, incidencia resuelta)
// vienen con un tag "[FALLA]"/"[INCIDENCIA]" al frente de la descripción —
// mismo criterio que parsearCategoria() en DashboardClient — para resaltarlas
// con un color distinto del "Novedad" genérico.
const CAT_TAG: Record<string, { dot: string; label: string }> = {
  FALLA:      { dot: 'bg-orange-500', label: 'Falla'      },
  INCIDENCIA: { dot: 'bg-red-500',    label: 'Incidencia' },
}

function parseNovedad(n: Novedad) {
  const match = n.descripcion.match(/^\[([^\]]+)\]\s*/)
  const tag = match ? CAT_TAG[match[1].toUpperCase()] : null
  return {
    style: tag ?? TIPO_STYLE[n.tipo] ?? TIPO_STYLE.novedad,
    detalle: match ? n.descripcion.slice(match[0].length) : n.descripcion,
  }
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
        {/* pb-8 — sin esto el último ítem de cualquier tab queda pegado al
            borde inferior del panel, sin aire, y se percibe como cortado. */}
        <div className="flex-1 overflow-y-auto pb-8">
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
                  {turno.encargado_telefono && (
                    <div className="flex items-center gap-2.5 text-sm text-gray-600">
                      <Phone size={14} className="text-gray-400 shrink-0" />
                      <a
                        href={`tel:${turno.encargado_telefono}`}
                        className="text-brand-orange font-medium text-base py-2.5 min-h-[44px] flex items-center"
                      >
                        {turno.encargado_telefono}
                      </a>
                      <span className="text-xs text-gray-400">(encargado)</span>
                    </div>
                  )}
                </div>

                {/* Ubicación GPS — apertura siempre, cierre/relevo si ya ocurrieron */}
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <MapPin size={13} className="text-gray-400" />
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Ubicación
                    </p>
                  </div>
                  <div className="flex flex-col divide-y divide-gray-100">
                    <GpsRow
                      evento={{
                        label: 'Apertura',
                        lat: turno.apertura_latitud,
                        lon: turno.apertura_longitud,
                        capturadoAt: turno.apertura_gps_capturado_at,
                      }}
                      cliente={turno.clientes}
                    />
                    {turno.estado !== 'abierto' && (
                      <GpsRow
                        evento={{
                          label: 'Cierre',
                          lat: turno.cierre_latitud,
                          lon: turno.cierre_longitud,
                          capturadoAt: turno.cierre_gps_capturado_at,
                        }}
                        cliente={turno.clientes}
                      />
                    )}
                    {turno.relevo_nombre && (
                      <GpsRow
                        evento={{
                          label: `Relevo (${turno.relevo_nombre})`,
                          lat: turno.relevo_latitud,
                          lon: turno.relevo_longitud,
                          capturadoAt: turno.relevo_gps_capturado_at,
                        }}
                        cliente={turno.clientes}
                      />
                    )}
                  </div>
                </div>

                {/* Personal de apoyo cubriendo el puesto */}
                {turno.participantes.length > 0 && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Users size={13} className="text-gray-400" />
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Apoyo en este turno
                      </p>
                    </div>
                    <div className="flex flex-col">
                      {turno.participantes.map(p => (
                        <div key={p.id} className="flex items-center justify-between gap-2 py-2 min-h-[44px]">
                          <span className="text-base text-gray-700">
                            {p.users ? `${p.users.nombre} ${p.users.apellido}` : 'Técnico'}
                            {p.users?.dni && <span className="text-gray-400 text-sm"> · DNI {p.users.dni}</span>}
                          </span>
                          {p.users?.telefono && (
                            <a
                              href={`tel:${p.users.telefono}`}
                              className="text-brand-orange font-medium text-base shrink-0"
                            >
                              {p.users.telefono}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Checklist de planillas del turno */}
                {turno.planillasChecklist.length > 0 && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <FileText size={13} className="text-gray-400" />
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Planillas del turno
                      </p>
                    </div>
                    <div className="flex flex-col">
                      {turno.planillasChecklist.map(p => (
                        <div key={p.slug} className="flex items-center gap-2 py-2 min-h-[44px]">
                          {p.enviada
                            ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                            : <Circle size={16} className="text-amber-400 shrink-0" />}
                          <span className={`text-base ${p.enviada ? 'text-gray-700' : 'text-amber-700 font-medium'}`}>
                            {p.nombre}
                          </span>
                          <span className="text-sm text-gray-400">
                            {p.enviada ? 'Enviada' : 'Pendiente'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                <TabBtn active={tab === 'incidencias'} onClick={() => setTab('incidencias')}>
                  Incidencias ({turno.incidencias.length})
                </TabBtn>
                <TabBtn active={tab === 'elementos'} onClick={() => setTab('elementos')}>
                  <Package size={13} />
                  Elementos
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
                          const { style, detalle } = parseNovedad(n)
                          return (
                            <div key={n.id} className="relative flex gap-4">
                              <div className={`w-3.5 h-3.5 rounded-full ${style.dot} shrink-0 mt-0.5 ring-2 ring-white z-10`} />
                              <div className="flex-1 min-w-0 pb-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-semibold text-gray-500">{n.hora}</span>
                                  <span className="text-xs text-gray-400">{style.label}</span>
                                </div>
                                <p className="text-sm text-gray-800 leading-relaxed">{detalle}</p>
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

              {/* Tab: Incidencias */}
              {tab === 'incidencias' && (
                <div className="p-5 space-y-3">
                  <p className="text-xs text-gray-400 leading-relaxed -mt-1 mb-1">
                    Problemas del puesto — quedan abiertas hasta que se resuelven, aunque cambie el técnico de turno. Distinto de una alerta puntual (ver en Alertas).
                  </p>
                  {turno.incidencias.length === 0 ? (
                    <div className="text-center py-6">
                      <AlertTriangle size={24} className="mx-auto mb-2 text-gray-200" />
                      <p className="text-sm text-gray-400">Sin incidencias para este puesto</p>
                    </div>
                  ) : (
                    turno.incidencias.map(inc => {
                      const sev = SEV_CONFIG[inc.severidad ?? 'bajo']
                      const est = ESTADO_INCIDENCIA[inc.estado]
                      const deEsteTurno = inc.turno_creacion_id === turno.id
                      return (
                        <div key={inc.id} className="border border-gray-100 rounded-xl p-3.5">
                          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                            <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${sev.badge}`}>
                              {sev.label}
                            </span>
                            <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${est.badge}`}>
                              {est.label}
                            </span>
                            <span className="text-[10px] font-medium text-gray-400">
                              {deEsteTurno ? 'Detectada en este turno' : 'Persiste de un turno anterior'}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-gray-800">{inc.titulo}</p>
                          {inc.descripcion && (
                            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{inc.descripcion}</p>
                          )}
                          {inc.foto_url && (
                            <FotoThumb
                              url={inc.foto_url}
                              onClick={() => setLightboxUrl(inc.foto_url!)}
                              className="w-28 h-20 mt-2"
                            />
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              )}

              {/* Tab: Elementos */}
              {tab === 'elementos' && (
                <div className="p-5 space-y-2">
                  {turno.elementos.length === 0 ? (
                    <div className="text-center py-6">
                      <Package size={24} className="mx-auto mb-2 text-gray-200" />
                      <p className="text-sm text-gray-400">Sin elementos asignados a este puesto</p>
                    </div>
                  ) : (
                    turno.elementos.map(el => {
                      const est = el.estado_operativo ? ESTADO_ELEMENTO[el.estado_operativo] : null
                      return (
                        <div key={el.id} className="flex items-center justify-between gap-3 border border-gray-100 rounded-xl px-3.5 py-2.5">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{el.nombre}</p>
                            <p className="text-xs text-gray-400">
                              {el.codigo_patrimonial}
                              {el.observacion ? ` · ${el.observacion}` : ''}
                            </p>
                          </div>
                          {el.estado_admin === 'en_mantenimiento' ? (
                            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              En mantenimiento
                            </span>
                          ) : est ? (
                            <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${est.badge}`}>
                              {est.label}
                            </span>
                          ) : (
                            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                              Sin controlar en este turno
                            </span>
                          )}
                        </div>
                      )
                    })
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
