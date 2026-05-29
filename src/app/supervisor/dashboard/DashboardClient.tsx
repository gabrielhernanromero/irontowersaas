'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Shield, AlertTriangle, MessageSquare, Bell,
  ChevronRight, Clock, MapPin, Package,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import ClienteSelector from './components/ClienteSelector'
import TurnoSheet      from './components/TurnoSheet'
import IncidenciaSheet from './components/IncidenciaSheet'

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
  created_at: string
  libro_turno: {
    id: string
    tecnico_nombre: string
    cliente_id: string | null
    clientes: ClienteRef | null
  } | null
}

interface IncidenciaActiva {
  id: string
  cliente_id: string
  titulo: string
  descripcion: string
  severidad: 'bajo' | 'medio' | 'alto' | null
  estado: string
  elemento_afectado_id: string | null
  created_at: string
  clientes: ClienteRef | null
  elemento: { id: string; nombre: string; codigo_patrimonial: string } | null
}

interface ResumenDia {
  turnosCerrados: number
  novedadesHoy: number
  incidenciasNuevasHoy: number
}

interface Props {
  supervisorId: string
  initialTurnos: TurnoActivo[]
  initialNovedades: NovedadFeed[]
  initialIncidencias: IncidenciaActiva[]
  initialAlertasSinLeer: number
  clientes: ClienteRef[]
  resumenDia: ResumenDia
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1)  return 'hace un momento'
  if (mins < 60) return `hace ${mins} min`
  const h = Math.floor(mins / 60)
  if (h < 24)    return `hace ${h}h`
  return `hace ${Math.floor(h / 24)} días`
}

function iniciales(nombre: string): string {
  return nombre.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function diasAbierta(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  return d === 0 ? 'hoy' : d === 1 ? 'hace 1 día' : `hace ${d} días`
}

function todayLabel(): string {
  return new Date().toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

// ── Severity config ───────────────────────────────────────────────────────────

const SEV: Record<string, { border: string; dot: string; badge: string }> = {
  alto:  { border: 'border-l-red-500',   dot: 'bg-red-500',   badge: 'bg-red-100 text-red-700'   },
  medio: { border: 'border-l-amber-400', dot: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700' },
  bajo:  { border: 'border-l-gray-300',  dot: 'bg-gray-300',  badge: 'bg-gray-100 text-gray-600'  },
}

const FEED_DOT: Record<string, string> = {
  apertura: 'bg-emerald-500',
  novedad:  'bg-blue-500',
  alerta:   'bg-red-500',
  cierre:   'bg-gray-400',
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
}: Props) {
  const [turnos,      setTurnos]      = useState(initialTurnos)
  const [novedades,   setNovedades]   = useState(initialNovedades)
  const [incidencias, setIncidencias] = useState(initialIncidencias)
  const [alertasSL,   setAlertasSL]   = useState(initialAlertasSinLeer)
  const [resumen,     setResumen]     = useState(initialResumen)

  const [clienteId, setClienteId] = useState<string | null>(null)

  const [turnoSheet,      setTurnoSheet]      = useState<string | null>(null)
  const [incidenciaSheet, setIncidenciaSheet] = useState<IncidenciaActiva | null>(null)

  // Ref for Realtime callbacks to see latest state without stale closures
  const turnosRef = useRef(turnos)
  useEffect(() => { turnosRef.current = turnos }, [turnos])

  // ── Realtime ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const client = supabase()

    // New novedades → enrich with turno data from state
    const novedadesChannel = client
      .channel('dashboard-novedades')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'libro_novedad' },
        (payload) => {
          const row    = payload.new as NovedadFeed
          const turno  = turnosRef.current.find(t => t.id === row.turno_id)
          const enriched: NovedadFeed = {
            ...row,
            libro_turno: turno
              ? { id: turno.id, tecnico_nombre: turno.tecnico_nombre, cliente_id: turno.cliente_id, clientes: turno.clientes }
              : null,
          }
          setNovedades(prev => [enriched, ...prev].slice(0, 50))
          setResumen(prev => ({ ...prev, novedadesHoy: prev.novedadesHoy + 1 }))

          // Update last novedad on turno card
          if (turno) {
            setTurnos(prev => prev.map(t =>
              t.id === turno.id
                ? { ...t, novedades: [row, ...t.novedades] }
                : t
            ))
          }
        }
      )
      .subscribe()

    // Turno updates (apertura, cierre, relevo)
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

    // Incidencias
    const incidenciasChannel = client
      .channel('dashboard-incidencias')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'incidencias' },
        (payload) => {
          const inc = payload.new as IncidenciaActiva
          if (inc.estado === 'abierto') {
            setIncidencias(prev => [inc, ...prev])
            setResumen(prev => ({ ...prev, incidenciasNuevasHoy: prev.incidenciasNuevasHoy + 1 }))
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

    // Alertas
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
        (payload) => {
          if (payload.new.leida) setAlertasSL(prev => Math.max(0, prev - 1))
        }
      )
      .subscribe()

    return () => {
      client.removeChannel(novedadesChannel)
      client.removeChannel(turnosChannel)
      client.removeChannel(incidenciasChannel)
      client.removeChannel(alertasChannel)
    }
  }, [supervisorId])

  // ── Filtered data ───────────────────────────────────────────────────────────
  const turnosFiltrados      = useMemo(() =>
    clienteId ? turnos.filter(t => t.cliente_id === clienteId) : turnos
  , [turnos, clienteId])

  const novedadesFiltradas   = useMemo(() =>
    clienteId
      ? novedades.filter(n => n.libro_turno?.cliente_id === clienteId)
      : novedades
  , [novedades, clienteId])

  const incidenciasFiltradas = useMemo(() =>
    clienteId ? incidencias.filter(i => i.cliente_id === clienteId) : incidencias
  , [incidencias, clienteId])

  // KPIs reflect filtered view when a cliente is selected
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

  function handleIncidenciaResolved(id: string) {
    setIncidencias(prev => prev.filter(i => i.id !== id))
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5 capitalize">{todayLabel()}</p>
        </div>
        <ClienteSelector
          clientes={clientes}
          value={clienteId}
          onChange={setClienteId}
        />
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          value={kpis.turnos}
          label="Guardias activas"
          icon={Shield}
          accentClass="text-emerald-600"
          iconBg="bg-emerald-50"
          live
        />
        <KpiCard
          value={kpis.incidencias}
          label="Incidencias abiertas"
          icon={AlertTriangle}
          accentClass="text-red-500"
          iconBg="bg-red-50"
        />
        <KpiCard
          value={kpis.novedades}
          label="Novedades hoy"
          icon={MessageSquare}
          accentClass="text-brand-orange"
          iconBg="bg-brand-orange/10"
        />
        <KpiCard
          value={kpis.alertas}
          label="Alertas sin leer"
          icon={Bell}
          accentClass="text-amber-500"
          iconBg="bg-amber-50"
        />
      </div>

      {/* ── Main 2-col ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Guardias en vivo (2/3) ── */}
        <div className="lg:col-span-2 space-y-3">
          <SectionLabel>
            Guardia en vivo
            <LiveBadge />
          </SectionLabel>

          {turnosFiltrados.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
              <Shield size={28} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-medium text-gray-400">Sin guardia activa</p>
              {clienteId && (
                <p className="text-xs text-gray-400 mt-1">para este cliente</p>
              )}
            </div>
          ) : (
            turnosFiltrados.map(turno => {
              const lastNov = turno.novedades[0]
              const isPendiente = turno.estado === 'pendiente_relevo'

              return (
                <div
                  key={turno.id}
                  onClick={() => setTurnoSheet(turno.id)}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 cursor-pointer hover:shadow-md hover:border-gray-200 transition-all group"
                >
                  <div className="flex items-start gap-3">
                    {/* Pulse dot */}
                    <div className="shrink-0 mt-1">
                      <span className="relative flex h-3 w-3">
                        {!isPendiente && (
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                        )}
                        <span className={`relative inline-flex rounded-full h-3 w-3 ${isPendiente ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-brand-ink">{turno.tecnico_nombre}</p>
                        <div className="flex items-center gap-2">
                          {isPendiente && (
                            <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">
                              Relevo
                            </span>
                          )}
                          <ChevronRight size={15} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                        </div>
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
                          desde {turno.horario_inicio}
                        </span>
                        <span className="text-xs text-gray-400">
                          {turno.turno === 'diurno' ? 'Diurno' : 'Nocturno'}
                        </span>
                      </div>

                      {lastNov && (
                        <p className="text-xs text-gray-500 mt-2 line-clamp-1 italic">
                          &ldquo;{lastNov.descripcion}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* ── Incidencias (1/3) ── */}
        <div className="space-y-3">
          <SectionLabel>Incidencias abiertas</SectionLabel>

          {incidenciasFiltradas.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
              <AlertTriangle size={24} className="mx-auto mb-2 text-gray-200" />
              <p className="text-sm text-gray-400">Sin incidencias abiertas</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
              {incidenciasFiltradas.map(inc => {
                const s = SEV[inc.severidad ?? 'bajo']
                return (
                  <button
                    key={inc.id}
                    onClick={() => setIncidenciaSheet(inc)}
                    className={`w-full text-left flex gap-0 border-l-4 ${s.border} hover:bg-gray-50 transition-colors group`}
                  >
                    <div className="flex-1 px-4 py-3 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 line-clamp-1 group-hover:text-brand-ink">
                        {inc.titulo}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {inc.clientes && (
                          <span className="text-xs text-gray-400">{inc.clientes.nombre_empresa}</span>
                        )}
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-400">{diasAbierta(inc.created_at)}</span>
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

      {/* ── Activity feed ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionLabel>Actividad en vivo</SectionLabel>
          <LiveBadge />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {novedadesFiltradas.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare size={24} className="mx-auto mb-2 text-gray-200" />
              <p className="text-sm text-gray-400">Sin actividad registrada hoy</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {novedadesFiltradas.map((nov, i) => {
                const turno  = nov.libro_turno
                const dot    = FEED_DOT[nov.tipo] ?? 'bg-gray-400'
                const nombre = turno?.tecnico_nombre ?? '—'
                const cli    = turno?.clientes?.nombre_empresa

                return (
                  <div key={nov.id} className={`flex gap-3.5 px-4 py-3.5 ${i === 0 ? 'bg-gray-50/50' : ''}`}>
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-brand-ink flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-white">{iniciales(nombre)}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-800">{nombre}</span>
                        {cli && <span className="text-xs text-gray-400">· {cli}</span>}
                        <span className="flex items-center gap-1 text-xs text-gray-400 ml-auto">
                          <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                          {timeAgo(nov.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{nov.descripcion}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Resumen del día ── */}
      <div className="space-y-3">
        <SectionLabel>Resumen del día</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ResumenCard
            value={resumen.turnosCerrados}
            label="Turnos cerrados"
            icon={Shield}
            color="text-gray-600"
          />
          <ResumenCard
            value={resumen.novedadesHoy}
            label="Novedades registradas"
            icon={MessageSquare}
            color="text-brand-orange"
          />
          <ResumenCard
            value={resumen.incidenciasNuevasHoy}
            label="Incidencias abiertas hoy"
            icon={AlertTriangle}
            color="text-red-500"
          />
        </div>
      </div>

      {/* ── Side sheets ── */}
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
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  value, label, icon: Icon, accentClass, iconBg, live,
}: {
  value: number
  label: string
  icon: React.ElementType
  accentClass: string
  iconBg: string
  live?: boolean
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center`}>
          <Icon size={17} className={accentClass} />
        </div>
        {live && value > 0 && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        )}
      </div>
      <p className={`text-4xl font-black ${accentClass}`}>{value}</p>
      <p className="text-sm text-gray-500 mt-1 leading-tight">{label}</p>
    </div>
  )
}

function ResumenCard({
  value, label, icon: Icon, color,
}: {
  value: number
  label: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
      <Icon size={20} className={`${color} shrink-0`} />
      <div>
        <p className={`text-2xl font-black ${color}`}>{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
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
