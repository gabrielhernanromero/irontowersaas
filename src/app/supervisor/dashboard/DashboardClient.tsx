'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  Shield, AlertTriangle, MessageSquare, Bell,
  ChevronRight, Clock, MapPin, AlertCircle, Siren, X,
  ClipboardCheck, Users, CheckCircle2, TrendingUp, Download,
  Camera, Filter, CheckCircle, TriangleAlert,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { downloadCsv } from '@/lib/exportCsv'
import ClienteSelector from './components/ClienteSelector'
import TurnoSheet      from './components/TurnoSheet'
import IncidenciaSheet from './components/IncidenciaSheet'
import NovedadSheet    from './components/NovedadSheet'
import RondasSheet     from './components/RondasSheet'

// ── Local types ───────────────────────────────────────────────────────────────

interface ClienteRef { id: string; nombre_empresa: string }

interface TurnoActivo {
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
  created_at: string
  clientes: ClienteRef | null
  novedades: { id: string; tipo: string; hora: string; descripcion: string; created_at: string }[]
}

interface NovedadFeed {
  id: string
  turno_id: string
  tipo: string
  hora: string
  descripcion: string
  incidencia_id: string | null
  planilla_id: string | null
  foto_url: string | null
  created_at: string
  libro_turno: {
    id: string
    tecnico_nombre: string
    cliente_id: string | null
    clientes: ClienteRef | null
  } | null
}

interface RondaDetalle {
  id: string
  turno_id: string
  numero_ronda: number
  completa: boolean
  total_puntos: number
  puntos_escaneados: number
  hora_inicio: string
  hora_fin: string | null
  tecnico_id: string
  cliente_id: string | null
  clientes: ClienteRef | null
  tecnico: { nombre: string; apellido: string } | null
}

interface IncidenciaActiva {
  id: string
  cliente_id: string
  titulo: string
  descripcion: string
  severidad: 'bajo' | 'medio' | 'alto' | null
  estado: string
  foto_url: string | null
  requiere_aprobacion: boolean
  estado_aprobacion: 'pendiente_revision' | 'aprobada' | 'rechazada'
  elemento_afectado_id: string | null
  created_at: string
  clientes: ClienteRef | null
  elemento: { id: string; nombre: string; codigo_patrimonial: string } | null
}

interface ResumenDia {
  turnosCerrados: number
  novedadesHoy: number
  incidenciasNuevasHoy: number
  rondasHoy: number
  rondasCompletas: number
  cumplimientoPromedio: number | null
  tecnicosActivos: number
}

interface Props {
  supervisorId: string
  initialTurnos: TurnoActivo[]
  initialNovedades: NovedadFeed[]
  initialIncidencias: IncidenciaActiva[]
  initialAlertasSinLeer: number
  clientes: ClienteRef[]
  resumenDia: ResumenDia
  rondasPorTurno: Record<string, { total: number; completas: number }>
  rondasDetalle: RondaDetalle[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayLabel(): string {
  return new Date().toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

function minutosDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
}

function horasAbierta(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3600000
}

function agingLabel(iso: string): string {
  const h = horasAbierta(iso)
  if (h < 1) return `hace ${Math.floor(h * 60)} min`
  if (h < 24) return `hace ${Math.floor(h)}h`
  return `hace ${Math.floor(h / 24)} días`
}

// Calcula % del turno transcurrido (diurno ≈ 8h, nocturno ≈ 12h)
function elapsedPct(horario_inicio: string, turno: 'diurno' | 'nocturno'): number {
  const duracion = turno === 'diurno' ? 8 * 3600 : 12 * 3600
  const [h, m] = horario_inicio.split(':').map(Number)
  const now   = new Date()
  const start = new Date(now)
  start.setHours(h, m, 0, 0)
  if (start.getTime() > now.getTime()) start.setDate(start.getDate() - 1)
  const elapsed = Math.max(0, (now.getTime() - start.getTime()) / 1000)
  return Math.min(100, Math.round((elapsed / duracion) * 100))
}

// ── Severity / category config ────────────────────────────────────────────────

const SEV: Record<string, { border: string; dot: string; badge: string }> = {
  alto:  { border: 'border-l-red-500',   dot: 'bg-red-500',   badge: 'bg-red-100 text-red-700'   },
  medio: { border: 'border-l-amber-400', dot: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700' },
  bajo:  { border: 'border-l-gray-300',  dot: 'bg-gray-300',  badge: 'bg-gray-100 text-gray-600'  },
}

const CAT_CLS: Record<string, string> = {
  RONDA:      'bg-green-100  text-green-700',
  INCIDENCIA: 'bg-red-100    text-red-700',
  CONTROL:    'bg-blue-100   text-blue-700',
  SISTEMA:    'bg-purple-100 text-purple-700',
  FALLA:      'bg-orange-100 text-orange-700',
  NOVEDAD:    'bg-sky-100    text-sky-700',
  ALERTA:     'bg-red-100    text-red-700',
  APERTURA:   'bg-emerald-100 text-emerald-700',
  CIERRE:     'bg-gray-100   text-gray-600',
}

export function parsearCategoria(descripcion: string, tipo: string): { label: string; cls: string } {
  const match = descripcion.match(/^\[([^\]]+)\]/)
  if (match) {
    const cat = match[1].toUpperCase()
    return { label: cat, cls: CAT_CLS[cat] ?? 'bg-gray-100 text-gray-600' }
  }
  const label = tipo.toUpperCase()
  return { label, cls: CAT_CLS[label] ?? 'bg-gray-100 text-gray-600' }
}

export function estadoActividad(tipo: string): { label: string; cls: string; dot: string } {
  const MAP: Record<string, { label: string; cls: string; dot: string }> = {
    apertura: { label: 'INICIADO',   cls: 'text-emerald-600', dot: 'bg-emerald-500' },
    cierre:   { label: 'CERRADO',    cls: 'text-gray-400',    dot: 'bg-gray-400'    },
    alerta:   { label: 'EN CURSO',   cls: 'text-amber-600',   dot: 'bg-amber-400'   },
    novedad:  { label: 'REGISTRADO', cls: 'text-blue-600',    dot: 'bg-blue-400'    },
  }
  return MAP[tipo] ?? { label: 'REGISTRADO', cls: 'text-gray-500', dot: 'bg-gray-400' }
}

type FeedFilter = 'todos' | 'apertura' | 'ronda' | 'novedad' | 'alerta'

const FEED_FILTERS: { key: FeedFilter; label: string }[] = [
  { key: 'todos',    label: 'Todos'     },
  { key: 'apertura', label: 'Aperturas' },
  { key: 'ronda',    label: 'Rondas'    },
  { key: 'novedad',  label: 'Novedades' },
  { key: 'alerta',   label: 'Alertas'   },
]

function matchesFeedFilter(nov: NovedadFeed, filter: FeedFilter): boolean {
  if (filter === 'todos') return true
  const cat = parsearCategoria(nov.descripcion, nov.tipo).label.toLowerCase()
  if (filter === 'apertura') return nov.tipo === 'apertura' || nov.tipo === 'cierre'
  if (filter === 'ronda')    return nov.tipo === 'ronda' || cat === 'ronda'
  if (filter === 'novedad')  return nov.tipo === 'novedad' && cat !== 'ronda'
  if (filter === 'alerta')   return nov.tipo === 'alerta' || cat === 'incidencia' || cat === 'falla' || cat === 'alerta'
  return true
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DashboardClient({
  supervisorId,
  initialTurnos,
  initialNovedades,
  initialIncidencias,
  initialAlertasSinLeer,
  clientes,
  resumenDia: initialResumen,
  rondasPorTurno: initialRondasPorTurno,
  rondasDetalle,
}: Props) {
  const [turnos,      setTurnos]      = useState(initialTurnos)
  const [novedades,   setNovedades]   = useState(initialNovedades)
  const [incidencias, setIncidencias] = useState(initialIncidencias)
  const [alertasSL,   setAlertasSL]   = useState(initialAlertasSinLeer)
  const [resumen,     setResumen]     = useState(initialResumen)
  const [rondasPorTurno, setRondasPorTurno] = useState(initialRondasPorTurno)

  const [clienteId, setClienteId] = useState<string | null>(null)
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('todos')

  const [turnoSheet,      setTurnoSheet]      = useState<string | null>(null)
  const [incidenciaSheet, setIncidenciaSheet] = useState<IncidenciaActiva | null>(null)
  const [novedadSheet,    setNovedadSheet]    = useState<NovedadFeed | null>(null)
  const [rondasSheetOpen, setRondasSheetOpen] = useState(false)

  // Ids de novedades que acaban de llegar por Realtime — para animar su entrada
  // en el timeline (distinto de "es la primera de la lista", que también es
  // cierto para la más reciente del fetch inicial y esa no debe animar).
  const [newNovedadIds, setNewNovedadIds] = useState<Set<string>>(new Set())

  // Scroll + highlight para los KPI que apuntan a una sección ya visible en la página
  const guardiaSectionRef     = useRef<HTMLDivElement>(null)
  const incidenciasSectionRef = useRef<HTMLDivElement>(null)
  const [highlightSection, setHighlightSection] = useState<'guardia' | 'incidencias' | null>(null)

  function irASeccion(ref: React.RefObject<HTMLDivElement>, key: 'guardia' | 'incidencias') {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setHighlightSection(key)
    setTimeout(() => setHighlightSection(prev => prev === key ? null : prev), 1500)
  }

  // Alerta crítica nivel ALTO
  const [alertaAlto, setAlertaAlto] = useState<IncidenciaActiva | null>(null)

  const dispararAlertaAlto = useCallback((inc: IncidenciaActiva) => {
    setAlertaAlto(inc)
    try {
      const ctx = new AudioContext()
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          const o = ctx.createOscillator(); const g = ctx.createGain()
          o.connect(g); g.connect(ctx.destination)
          o.type = 'sawtooth'; o.frequency.setValueAtTime(880, ctx.currentTime)
          o.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5)
          g.gain.setValueAtTime(0.3, ctx.currentTime)
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
          o.start(); o.stop(ctx.currentTime + 0.8)
        }, i * 900)
      }
    } catch { /* autoplay policy */ }
  }, [])

  const turnosRef = useRef(turnos)
  useEffect(() => { turnosRef.current = turnos }, [turnos])

  // ── Realtime ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const client = supabase()

    const novedadesChannel = client
      .channel('dashboard-novedades')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'libro_novedad' },
        (payload) => {
          console.log('[realtime] INSERT libro_novedad recibido:', payload.new)
          const row   = payload.new as NovedadFeed
          const turno = turnosRef.current.find(t => t.id === row.turno_id)
          const enriched: NovedadFeed = {
            ...row,
            libro_turno: turno
              ? { id: turno.id, tecnico_nombre: turno.tecnico_nombre, cliente_id: turno.cliente_id, clientes: turno.clientes }
              : null,
          }
          setNovedades(prev => [enriched, ...prev].slice(0, 50))
          setResumen(prev => ({ ...prev, novedadesHoy: prev.novedadesHoy + 1 }))
          setNewNovedadIds(prev => new Set(prev).add(enriched.id))
          setTimeout(() => {
            setNewNovedadIds(prev => {
              const next = new Set(prev)
              next.delete(enriched.id)
              return next
            })
          }, 2000)
          if (turno) {
            setTurnos(prev => prev.map(t =>
              t.id === turno.id ? { ...t, novedades: [row, ...t.novedades] } : t
            ))
          }
        }
      )
      .subscribe((status, err) => {
        console.log('[realtime] canal dashboard-novedades:', status, err ?? '')
      })

    const turnosChannel = client
      .channel('dashboard-turnos')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'libro_turno' },
        (payload) => {
          const t = payload.new as TurnoActivo
          if (t.estado === 'abierto' || t.estado === 'pendiente_relevo') {
            setTurnos(prev => [t, ...prev])
          }
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'libro_turno' },
        (payload) => {
          const updated = payload.new as TurnoActivo
          if (updated.estado === 'cerrado') {
            setTurnos(prev => prev.filter(t => t.id !== updated.id))
            setResumen(prev => ({ ...prev, turnosCerrados: prev.turnosCerrados + 1 }))
          } else {
            setTurnos(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t))
          }
        }
      )
      .subscribe()

    const incidenciasChannel = client
      .channel('dashboard-incidencias')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'incidencias' },
        (payload) => {
          const inc = payload.new as IncidenciaActiva
          if (inc.estado === 'abierto') {
            setIncidencias(prev => [inc, ...prev])
            setResumen(prev => ({ ...prev, incidenciasNuevasHoy: prev.incidenciasNuevasHoy + 1 }))
            if (inc.severidad === 'alto') dispararAlertaAlto(inc)
          }
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'incidencias' },
        (payload) => {
          const updated = payload.new as IncidenciaActiva
          if (updated.estado === 'resuelto') {
            setIncidencias(prev => prev.filter(i => i.id !== updated.id))
          } else {
            setIncidencias(prev => prev.map(i => i.id === updated.id ? { ...i, ...updated } : i))
          }
        }
      )
      .subscribe()

    const alertasChannel = client
      .channel('dashboard-alertas')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alertas',
          filter: `destinatario_id=eq.${supervisorId}` },
        () => setAlertasSL(prev => prev + 1)
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'alertas',
          filter: `destinatario_id=eq.${supervisorId}` },
        (payload) => { if (payload.new.leida) setAlertasSL(prev => Math.max(0, prev - 1)) }
      )
      .subscribe()

    return () => {
      client.removeChannel(novedadesChannel)
      client.removeChannel(turnosChannel)
      client.removeChannel(incidenciasChannel)
      client.removeChannel(alertasChannel)
    }
  }, [supervisorId, dispararAlertaAlto])

  // ── Filtered data ───────────────────────────────────────────────────────────
  const turnosFiltrados      = useMemo(() =>
    clienteId ? turnos.filter(t => t.cliente_id === clienteId) : turnos
  , [turnos, clienteId])

  const novedadesFiltradas   = useMemo(() => {
    const byCliente = clienteId
      ? novedades.filter(n => n.libro_turno?.cliente_id === clienteId)
      : novedades
    return byCliente.filter(n => matchesFeedFilter(n, feedFilter))
  }, [novedades, clienteId, feedFilter])

  const incidenciasFiltradas = useMemo(() =>
    clienteId ? incidencias.filter(i => i.cliente_id === clienteId) : incidencias
  , [incidencias, clienteId])

  // Incidencias ordenadas: ALTO → MEDIO → BAJO, luego por tiempo abierta (mayor primero)
  const incidenciasOrdenadas = useMemo(() => {
    const sevOrder = { alto: 0, medio: 1, bajo: 2 }
    return [...incidenciasFiltradas].sort((a, b) => {
      const sa = sevOrder[a.severidad ?? 'bajo']
      const sb = sevOrder[b.severidad ?? 'bajo']
      if (sa !== sb) return sa - sb
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })
  }, [incidenciasFiltradas])

  const kpis = clienteId
    ? {
        turnos:      turnosFiltrados.length,
        incidencias: incidenciasFiltradas.length,
        novedades:   novedadesFiltradas.length,
        alertas:     alertasSL,
      }
    : {
        turnos:      turnos.length,
        incidencias: incidencias.length,
        novedades:   resumen.novedadesHoy,
        alertas:     alertasSL,
      }

  // ── Zona de atención inmediata ──────────────────────────────────────────────
  const itemsUrgentes = useMemo(() => {
    const items: { tipo: 'relevo' | 'incidencia_alta' | 'aprobacion'; label: string; sub: string; id: string; inc?: IncidenciaActiva }[] = []

    // Turnos con relevo pendiente
    turnos
      .filter(t => t.estado === 'pendiente_relevo')
      .forEach(t => items.push({
        tipo: 'relevo',
        label: `Relevo pendiente — ${t.tecnico_nombre}`,
        sub: t.clientes?.nombre_empresa ?? 'Sin cliente',
        id: t.id,
      }))

    // Incidencias ALTO sin resolver hace > 30 min
    incidencias
      .filter(i => i.severidad === 'alto' && minutosDesde(i.created_at) > 30)
      .forEach(i => items.push({
        tipo: 'incidencia_alta',
        label: i.titulo,
        sub: `${i.clientes?.nombre_empresa ?? ''} · ${agingLabel(i.created_at)}`,
        id: i.id,
        inc: i,
      }))

    // Incidencias que esperan aprobación del encargado > 15 min
    incidencias
      .filter(i => i.requiere_aprobacion && i.estado_aprobacion === 'pendiente_revision' && minutosDesde(i.created_at) > 15)
      .forEach(i => {
        if (!items.find(x => x.id === i.id)) {
          items.push({
            tipo: 'aprobacion',
            label: `Aprobación pendiente — ${i.titulo}`,
            sub: `${i.clientes?.nombre_empresa ?? ''} · ${agingLabel(i.created_at)}`,
            id: i.id,
            inc: i,
          })
        }
      })

    return items
  }, [turnos, incidencias])

  function handleIncidenciaResolved(id: string) {
    setIncidencias(prev => prev.filter(i => i.id !== id))
    if (incidenciaSheet?.id === id) setIncidenciaSheet(null)
  }

  function exportarIncidencias() {
    const rows = incidenciasFiltradas.map(inc => ({
      Fecha:      inc.created_at.slice(0, 10),
      Hora:       new Date(inc.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      Cliente:    inc.clientes?.nombre_empresa ?? '',
      Título:     inc.titulo,
      Descripción:inc.descripcion,
      Severidad:  inc.severidad ?? '',
      Estado:     inc.estado,
      Elemento:   inc.elemento?.nombre ?? '',
      'Cód. Patrimonial': inc.elemento?.codigo_patrimonial ?? '',
    }))
    downloadCsv(rows, 'incidencias')
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">

      {/* ── Modal alerta crítica nivel ALTO ── */}
      {alertaAlto && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border-4 border-red-500">
            <div className="bg-red-600 px-5 py-4 flex items-center gap-3 animate-pulse">
              <Siren size={28} className="text-white shrink-0" />
              <div>
                <p className="text-white font-black text-lg uppercase tracking-wide">ALERTA CRÍTICA</p>
                <p className="text-red-200 text-xs">Nivel ALTO — acción inmediata requerida</p>
              </div>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="font-bold text-gray-900 text-base">{alertaAlto.titulo}</p>
              <p className="text-sm text-gray-600">{alertaAlto.descripcion}</p>
              {alertaAlto.clientes && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
                  <MapPin size={13} />
                  {alertaAlto.clientes.nombre_empresa}
                </div>
              )}
            </div>
            <div className="px-5 pb-5">
              <button
                onClick={() => setAlertaAlto(null)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-colors min-h-[48px]"
              >
                <X size={16} />
                Entendido — registrar atención
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <LiveBadge />
          </div>
          <p className="text-sm text-gray-500 mt-1 capitalize">{todayLabel()}</p>
        </div>
        <ClienteSelector clientes={clientes} value={clienteId} onChange={setClienteId} />
      </div>

      {/* ── Zona de atención inmediata ── */}
      {itemsUrgentes.length > 0 && (
        <div className="rounded-2xl bg-red-50/70 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3">
            <TriangleAlert size={14} className="text-red-600 shrink-0" />
            <p className="text-xs font-bold text-red-700 uppercase tracking-wider">
              {itemsUrgentes.length} {itemsUrgentes.length === 1 ? 'situación requiere atención' : 'situaciones requieren atención'}
            </p>
          </div>
          <div className="divide-y divide-red-100/70">
            {itemsUrgentes.map((item) => (
              <button
                key={`${item.tipo}-${item.id}`}
                onClick={() => item.tipo === 'relevo' ? setTurnoSheet(item.id) : item.inc && setIncidenciaSheet(item.inc)}
                className="w-full text-left px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-red-100/50 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    item.tipo === 'relevo'          ? 'bg-amber-500' :
                    item.tipo === 'incidencia_alta' ? 'bg-red-500'   :
                    'bg-orange-500'
                  }`} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-red-800 line-clamp-1">{item.label}</p>
                    <p className="text-xs text-red-600 mt-0.5">{item.sub}</p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-red-400 shrink-0 group-hover:text-red-600 transition-colors" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── KPIs (franja única, clickeable) ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm grid grid-cols-2 sm:grid-cols-4 divide-y divide-x-0 sm:divide-y-0 sm:divide-x divide-gray-100">
        <KpiItem
          value={kpis.turnos}
          label="Guardias activas"
          icon={Shield}
          onClick={() => irASeccion(guardiaSectionRef, 'guardia')}
          sub={
            turnos.filter(t => t.estado === 'pendiente_relevo').length > 0
              ? { text: `${turnos.filter(t => t.estado === 'pendiente_relevo').length} con relevo pendiente`, cls: 'text-amber-600' }
              : { text: 'todas en orden', cls: 'text-gray-400' }
          }
        />
        <KpiItem
          value={resumen.tecnicosActivos}
          label="Técnicos en guardia"
          icon={Users}
          onClick={() => irASeccion(guardiaSectionRef, 'guardia')}
          sub={{ text: `${resumen.turnosCerrados} cerradas hoy`, cls: 'text-gray-400' }}
        />
        <KpiItem
          value={kpis.incidencias}
          label="Incidencias abiertas"
          icon={AlertTriangle}
          valueColorClass={kpis.incidencias > 0 ? 'text-red-600' : undefined}
          onClick={() => irASeccion(incidenciasSectionRef, 'incidencias')}
          sub={
            incidencias.filter(i => i.severidad === 'alto').length > 0
              ? { text: `${incidencias.filter(i => i.severidad === 'alto').length} de severidad alta`, cls: 'text-red-500 font-semibold' }
              : { text: 'sin críticas abiertas', cls: 'text-gray-400' }
          }
        />
        <KpiItem
          value={resumen.cumplimientoPromedio === null ? '—' : `${resumen.cumplimientoPromedio}%`}
          label="Cumplimiento rondas"
          icon={TrendingUp}
          valueColorClass={
            resumen.cumplimientoPromedio === null ? undefined :
            resumen.cumplimientoPromedio >= 90 ? 'text-emerald-600' :
            resumen.cumplimientoPromedio >= 70 ? 'text-amber-600' : 'text-red-600'
          }
          onClick={() => setRondasSheetOpen(true)}
          sub={{ text: `${resumen.rondasCompletas}/${resumen.rondasHoy} rondas completas`, cls: 'text-gray-400' }}
        />
      </div>

      {/* ── Main 2-col ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Guardias en vivo (2/3) ── */}
        <div
          ref={guardiaSectionRef}
          className={`lg:col-span-2 space-y-3 rounded-2xl transition-shadow duration-500 ${
            highlightSection === 'guardia' ? 'ring-2 ring-brand-orange/50 ring-offset-4' : ''
          }`}
        >
          <SectionLabel>Guardia en vivo</SectionLabel>

          {turnosFiltrados.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
              <Shield size={28} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-medium text-gray-400">Sin guardia activa</p>
              {clienteId && <p className="text-xs text-gray-400 mt-1">para este cliente</p>}
            </div>
          ) : (
            turnosFiltrados.map(turno => {
              const lastNov    = turno.novedades[0]
              const isPendiente = turno.estado === 'pendiente_relevo'
              const pct        = elapsedPct(turno.horario_inicio, turno.turno)
              const rondas     = rondasPorTurno[turno.id]
              const isOvertime = pct >= 100

              return (
                <div
                  key={turno.id}
                  onClick={() => setTurnoSheet(turno.id)}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 cursor-pointer hover:shadow-md hover:border-gray-200 transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-1.5">
                      <span className="relative flex h-3 w-3">
                        {!isPendiente && !isOvertime && (
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                        )}
                        <span className={`relative inline-flex rounded-full h-3 w-3 ${
                          isPendiente ? 'bg-amber-400' : isOvertime ? 'bg-red-500' : 'bg-emerald-500'
                        }`} />
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-brand-ink">{turno.tecnico_nombre}</p>
                            {isPendiente && (
                              <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">
                                Relevo pendiente
                              </span>
                            )}
                            {isOvertime && !isPendiente && (
                              <span className="text-xs bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">
                                Tiempo extendido
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            {turno.clientes && (
                              <span className="flex items-center gap-1 text-xs text-gray-500">
                                <MapPin size={11} className="text-gray-400" />
                                {turno.clientes.nombre_empresa}
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <Clock size={11} className="text-gray-400" />
                              {turno.horario_inicio} · {turno.turno === 'diurno' ? 'Diurno' : 'Nocturno'}
                            </span>
                            <span className="text-xs text-gray-400">
                              {turno.novedades.length} novedad{turno.novedades.length !== 1 ? 'es' : ''}
                            </span>
                            {rondas && (
                              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-md ${
                                rondas.completas === rondas.total
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-purple-100 text-purple-700'
                              }`}>
                                {rondas.completas}/{rondas.total} rondas
                              </span>
                            )}
                          </div>

                          {lastNov && (
                            <p className="text-xs text-gray-500 mt-1.5 line-clamp-1 italic">
                              &ldquo;{lastNov.descripcion}&rdquo;
                            </p>
                          )}

                          {/* Progress bar */}
                          <div className="mt-2.5">
                            <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  isOvertime   ? 'bg-red-400'   :
                                  pct >= 80    ? 'bg-amber-400' :
                                  'bg-emerald-400'
                                }`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <p className="text-[10px] text-gray-400 mt-0.5">{pct}% del turno transcurrido</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <LiveTimer inicio={turno.horario_inicio} />
                          <ChevronRight size={15} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* ── Incidencias (1/3) ── */}
        <div
          ref={incidenciasSectionRef}
          className={`space-y-3 rounded-2xl transition-shadow duration-500 ${
            highlightSection === 'incidencias' ? 'ring-2 ring-brand-orange/50 ring-offset-4' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <SectionLabel>Incidencias abiertas</SectionLabel>
            {incidenciasFiltradas.length > 0 && (
              <button
                onClick={exportarIncidencias}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                title="Exportar CSV"
              >
                <Download size={12} />
                CSV
              </button>
            )}
          </div>

          {incidenciasOrdenadas.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
              <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-200" />
              <p className="text-sm text-gray-400">Sin incidencias abiertas</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
              {incidenciasOrdenadas.map(inc => {
                const s    = SEV[inc.severidad ?? 'bajo']
                const hAge = horasAbierta(inc.created_at)
                const ageCls =
                  hAge > 4  ? 'text-red-500'   :
                  hAge > 1  ? 'text-amber-500' :
                  'text-gray-400'
                return (
                  <button
                    key={inc.id}
                    onClick={() => setIncidenciaSheet(inc)}
                    className={`w-full text-left flex gap-0 border-l-4 ${s.border} hover:bg-gray-50 transition-colors group`}
                  >
                    <div className="flex-1 px-4 py-3 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${s.badge}`}>
                          {inc.severidad ?? 'bajo'}
                        </span>
                        {inc.requiere_aprobacion && inc.estado_aprobacion === 'pendiente_revision' && (
                          <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">
                            Pend. aprobación
                          </span>
                        )}
                        {inc.foto_url && (
                          <Camera size={11} className="text-gray-400" />
                        )}
                      </div>
                      <p className="text-sm font-semibold text-gray-800 line-clamp-1 group-hover:text-brand-ink">
                        {inc.titulo}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {inc.clientes && (
                          <span className="text-xs text-gray-400">{inc.clientes.nombre_empresa}</span>
                        )}
                        <span className={`text-xs font-medium ${ageCls}`}>{agingLabel(inc.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center pr-3">
                      <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Activity feed — timeline vertical ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <SectionLabel>Actividad en vivo</SectionLabel>
          {/* Filter chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter size={12} className="text-gray-400" />
            {FEED_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFeedFilter(f.key)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                  feedFilter === f.key
                    ? 'bg-brand-ink text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          {novedadesFiltradas.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare size={24} className="mx-auto mb-2 text-gray-200" />
              <p className="text-sm text-gray-400">
                {feedFilter === 'todos' ? 'Sin actividad registrada hoy' : 'Sin entradas en esta categoría'}
              </p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-100" />
              <div className="space-y-1">
                {novedadesFiltradas.map((nov) => {
                  const turno  = nov.libro_turno
                  const cat    = parsearCategoria(nov.descripcion, nov.tipo)
                  const estado = estadoActividad(nov.tipo)
                  const nombre = turno?.tecnico_nombre ?? '—'
                  const cli    = turno?.clientes?.nombre_empresa
                  const detalle = nov.descripcion.replace(/^\[[^\]]+\]\s*/, '')
                  const fecha = new Date(nov.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
                  const esNueva = newNovedadIds.has(nov.id)

                  return (
                    <button
                      key={nov.id}
                      onClick={() => setNovedadSheet(nov)}
                      className={`relative w-full text-left flex gap-4 rounded-xl px-3 py-3 -mx-3 hover:bg-gray-50 transition-colors group ${
                        esNueva ? 'animate-fade-in-slide bg-blue-50/40' : ''
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-full shrink-0 mt-0.5 ring-2 ring-white z-10 ${estado.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="font-mono text-xs font-semibold text-gray-500 tabular-nums">
                            {fecha} · {nov.hora}
                          </span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${cat.cls}`}>{cat.label}</span>
                          {nov.foto_url && <Camera size={12} className="text-gray-400" />}
                        </div>
                        <p className="text-sm text-gray-700 line-clamp-1 group-hover:text-brand-ink">
                          {detalle || nov.descripcion}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {nombre}{cli ? ` · ${cli}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-bold tracking-wide ${estado.cls}`}>{estado.label}</span>
                        <ChevronRight size={13} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Side sheets + lightbox ── */}
      {turnoSheet && (
        <TurnoSheet
          turnoId={turnoSheet}
          onClose={() => setTurnoSheet(null)}
        />
      )}
      {incidenciaSheet && (
        <IncidenciaSheet
          incidencia={incidenciaSheet}
          onClose={() => setIncidenciaSheet(null)}
          onResolved={handleIncidenciaResolved}
        />
      )}
      {novedadSheet && (
        <NovedadSheet
          novedad={novedadSheet}
          onClose={() => setNovedadSheet(null)}
          onVerIncidencia={(incidenciaId) => {
            const inc = incidencias.find(i => i.id === incidenciaId)
            if (inc) {
              setNovedadSheet(null)
              setIncidenciaSheet(inc)
            }
          }}
        />
      )}
      {rondasSheetOpen && (
        <RondasSheet
          rondas={rondasDetalle}
          onClose={() => setRondasSheetOpen(false)}
        />
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiItem({
  value, label, icon: Icon, valueColorClass, onClick, sub,
}: {
  value: number | string
  label: string
  icon: React.ElementType
  valueColorClass?: string
  onClick?: () => void
  sub?: { text: string; cls: string }
}) {
  return (
    <button
      onClick={onClick}
      className="text-left p-5 hover:bg-gray-50/70 transition-colors"
    >
      <Icon size={16} className="text-gray-300 mb-3" />
      <p className={`text-4xl font-black ${valueColorClass ?? 'text-gray-900'}`}>{value}</p>
      <p className="text-sm text-gray-500 mt-1 leading-tight">{label}</p>
      {sub && <p className={`text-xs mt-1 ${sub.cls}`}>{sub.text}</p>}
    </button>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{children}</p>
    </div>
  )
}

function LiveBadge() {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
      </span>
      EN VIVO
    </span>
  )
}

function LiveTimer({ inicio }: { inicio: string }) {
  const [elapsed, setElapsed] = useState('--:--:--')

  useEffect(() => {
    function calc() {
      const [h, m] = inicio.split(':').map(Number)
      const now   = new Date()
      const start = new Date(now)
      start.setHours(h, m, 0, 0)
      if (start.getTime() > now.getTime()) start.setDate(start.getDate() - 1)
      const diff = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 1000))
      const hh   = Math.floor(diff / 3600)
      const mm   = Math.floor((diff % 3600) / 60)
      const ss   = diff % 60
      setElapsed(
        `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
      )
    }
    calc()
    const id = setInterval(calc, 1000)
    return () => clearInterval(id)
  }, [inicio])

  return (
    <div className="text-right">
      <p className="font-mono text-base font-black text-emerald-600 tabular-nums leading-none tracking-tight">
        {elapsed}
      </p>
      <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wide">en guardia</p>
    </div>
  )
}
