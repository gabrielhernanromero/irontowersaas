'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  Shield, AlertTriangle, MessageSquare, Bell,
  ChevronRight, Clock, MapPin, AlertCircle, Siren, X,
  ClipboardCheck, Users, CheckCircle2, TrendingUp, Download,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { downloadCsv } from '@/lib/exportCsv'
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

function parsearCategoria(descripcion: string, tipo: string): { label: string; cls: string } {
  const match = descripcion.match(/^\[([^\]]+)\]/)
  if (match) {
    const cat = match[1].toUpperCase()
    return { label: cat, cls: CAT_CLS[cat] ?? 'bg-gray-100 text-gray-600' }
  }
  const label = tipo.toUpperCase()
  return { label, cls: CAT_CLS[label] ?? 'bg-gray-100 text-gray-600' }
}

function estadoActividad(tipo: string): { label: string; cls: string; dot: string } {
  const MAP: Record<string, { label: string; cls: string; dot: string }> = {
    apertura: { label: 'INICIADO',   cls: 'text-emerald-600', dot: 'bg-emerald-500' },
    cierre:   { label: 'CERRADO',    cls: 'text-gray-400',    dot: 'bg-gray-400'    },
    alerta:   { label: 'EN CURSO',   cls: 'text-amber-600',   dot: 'bg-amber-400'   },
    novedad:  { label: 'REGISTRADO', cls: 'text-blue-600',    dot: 'bg-blue-400'    },
  }
  return MAP[tipo] ?? { label: 'REGISTRADO', cls: 'text-gray-500', dot: 'bg-gray-400' }
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

  // Alerta crítica nivel ALTO
  const [alertaAlto, setAlertaAlto] = useState<IncidenciaActiva | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const dispararAlertaAlto = useCallback((inc: IncidenciaActiva) => {
    setAlertaAlto(inc)
    // Reproducir sonido de alarma usando Web Audio API (sin archivo externo)
    try {
      const ctx = new AudioContext()
      const oscillator = ctx.createOscillator()
      const gainNode   = ctx.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)
      oscillator.type = 'sawtooth'
      oscillator.frequency.setValueAtTime(880, ctx.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5)
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.8)
      // Repetir 3 veces
      setTimeout(() => {
        const o2 = ctx.createOscillator(); const g2 = ctx.createGain()
        o2.connect(g2); g2.connect(ctx.destination)
        o2.type = 'sawtooth'; o2.frequency.setValueAtTime(880, ctx.currentTime)
        o2.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5)
        g2.gain.setValueAtTime(0.3, ctx.currentTime)
        g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
        o2.start(); o2.stop(ctx.currentTime + 0.8)
      }, 900)
      setTimeout(() => {
        const o3 = ctx.createOscillator(); const g3 = ctx.createGain()
        o3.connect(g3); g3.connect(ctx.destination)
        o3.type = 'sawtooth'; o3.frequency.setValueAtTime(880, ctx.currentTime)
        o3.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5)
        g3.gain.setValueAtTime(0.3, ctx.currentTime)
        g3.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
        o3.start(); o3.stop(ctx.currentTime + 0.8)
      }, 1800)
    } catch {
      // AudioContext bloqueado (autoplay policy) — solo visual
    }
  }, [])

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
            // Alerta crítica inmediata para nivel ALTO (independiente del flujo de aprobación)
            if (inc.severidad === 'alto') {
              dispararAlertaAlto(inc)
            }
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
    <div className="space-y-6">

      {/* ── Modal alerta crítica nivel ALTO ── */}
      {alertaAlto && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border-4 border-red-500">
            {/* Cabecera roja pulsante */}
            <div className="bg-red-600 px-5 py-4 flex items-center gap-3 animate-pulse">
              <Siren size={28} className="text-white shrink-0" />
              <div>
                <p className="text-white font-black text-lg uppercase tracking-wide">
                  ALERTA CRÍTICA
                </p>
                <p className="text-red-200 text-xs">Nivel ALTO — acción inmediata requerida</p>
              </div>
            </div>
            {/* Contenido */}
            <div className="px-5 py-4 space-y-3">
              <p className="font-bold text-gray-900 text-base">{alertaAlto.titulo}</p>
              <p className="text-sm text-gray-600">{alertaAlto.descripcion}</p>
              {alertaAlto.clientes && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
                  <MapPin size={13} />
                  {alertaAlto.clientes.nombre_empresa}
                </div>
              )}
              <p className="text-xs text-gray-400">
                Registrada {timeAgo(alertaAlto.created_at)}
              </p>
            </div>
            {/* Botón dismiss */}
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
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5 capitalize">{todayLabel()}</p>
        </div>
        <ClienteSelector
          clientes={clientes}
          value={clienteId}
          onChange={setClienteId}
        />
      </div>

      {/* ── Banner relevo pendiente ── */}
      {turnos.some(t => t.estado === 'pendiente_relevo') && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertCircle size={16} className="text-amber-500 shrink-0" />
          <p className="text-sm font-semibold text-amber-700">
            {turnos.filter(t => t.estado === 'pendiente_relevo').length === 1
              ? '1 turno pendiente de relevo'
              : `${turnos.filter(t => t.estado === 'pendiente_relevo').length} turnos pendientes de relevo`}
          </p>
        </div>
      )}

      {/* ── KPI row — operativo en tiempo real ── */}
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
          value={resumen.tecnicosActivos}
          label="Técnicos en guardia"
          icon={Users}
          accentClass="text-blue-600"
          iconBg="bg-blue-50"
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
          value={kpis.alertas}
          label="Alertas sin leer"
          icon={Bell}
          accentClass="text-amber-500"
          iconBg="bg-amber-50"
        />
      </div>

      {/* ── KPI row — resumen del día ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          value={resumen.novedadesHoy}
          label="Novedades hoy"
          icon={MessageSquare}
          accentClass="text-brand-orange"
          iconBg="bg-brand-orange/10"
        />
        <KpiCard
          value={resumen.turnosCerrados}
          label="Guardias cerradas hoy"
          icon={CheckCircle2}
          accentClass="text-gray-500"
          iconBg="bg-gray-100"
        />
        <KpiCard
          value={resumen.rondasHoy}
          label={`Rondas hoy (${resumen.rondasCompletas} completas)`}
          icon={ClipboardCheck}
          accentClass="text-purple-600"
          iconBg="bg-purple-50"
        />
        <KpiCardPct
          value={resumen.cumplimientoPromedio}
          label="Cumplimiento rondas"
          icon={TrendingUp}
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
                    <div className="shrink-0 mt-1.5">
                      <span className="relative flex h-3 w-3">
                        {!isPendiente && (
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                        )}
                        <span className={`relative inline-flex rounded-full h-3 w-3 ${isPendiente ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        {/* Left: info */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-brand-ink">{turno.tecnico_nombre}</p>
                            {isPendiente && (
                              <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">
                                Relevo pendiente
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
                          </div>

                          {lastNov && (
                            <p className="text-xs text-gray-500 mt-1.5 line-clamp-1 italic">
                              &ldquo;{lastNov.descripcion}&rdquo;
                            </p>
                          )}
                        </div>

                        {/* Right: timer + chevron */}
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
        <div className="space-y-3">
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

          {incidenciasFiltradas.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
              <AlertTriangle size={24} className="mx-auto mb-2 text-gray-200" />
              <p className="text-sm text-gray-400">Sin incidencias abiertas</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden divide-y divide-gray-50 dark:divide-gray-700">
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

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          {novedadesFiltradas.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare size={24} className="mx-auto mb-2 text-gray-200" />
              <p className="text-sm text-gray-400">Sin actividad registrada hoy</p>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="grid grid-cols-[72px_140px_1fr_130px] px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                {['HORA', 'CATEGORÍA', 'DETALLE / OBSERVACIÓN', 'ESTADO'].map(h => (
                  <span key={h} className="text-xs font-semibold text-gray-400 uppercase tracking-wide last:text-right">
                    {h}
                  </span>
                ))}
              </div>

              {/* Rows */}
              <div className="divide-y divide-gray-50">
                {novedadesFiltradas.map((nov, i) => {
                  const turno  = nov.libro_turno
                  const cat    = parsearCategoria(nov.descripcion, nov.tipo)
                  const estado = estadoActividad(nov.tipo)
                  const nombre = turno?.tecnico_nombre ?? '—'
                  const cli    = turno?.clientes?.nombre_empresa
                  const detalle = nov.descripcion.replace(/^\[[^\]]+\]\s*/, '')

                  return (
                    <div
                      key={nov.id}
                      className={`grid grid-cols-[72px_140px_1fr_130px] px-4 py-3 items-center transition-colors ${
                        i === 0 ? 'bg-blue-50/20' : 'hover:bg-gray-50/50'
                      }`}
                    >
                      {/* Hora */}
                      <span className="font-mono text-sm text-gray-600 font-medium tabular-nums">
                        {nov.hora}
                      </span>

                      {/* Categoría */}
                      <div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${cat.cls}`}>
                          {cat.label}
                        </span>
                      </div>

                      {/* Detalle */}
                      <div className="min-w-0 pr-4">
                        <p className="text-sm text-gray-700 line-clamp-1">
                          {detalle || nov.descripcion}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {nombre}{cli ? ` · ${cli}` : ''}
                        </p>
                      </div>

                      {/* Estado */}
                      <div className="flex items-center justify-end gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${estado.dot}`} />
                        <span className={`text-xs font-bold tracking-wide ${estado.cls}`}>
                          {estado.label}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
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
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
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
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-tight">{label}</p>
    </div>
  )
}

function KpiCardPct({
  value, label, icon: Icon,
}: {
  value: number | null
  label: string
  icon: React.ElementType
}) {
  const color = value === null ? 'text-gray-400' : value >= 90 ? 'text-emerald-600' : value >= 70 ? 'text-amber-500' : 'text-red-500'
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-xl bg-gray-50 dark:bg-gray-700 flex items-center justify-center">
          <Icon size={17} className={color} />
        </div>
      </div>
      <p className={`text-4xl font-black ${color}`}>
        {value === null ? '—' : `${value}%`}
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-tight">{label}</p>
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
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 flex items-center gap-4">
      <Icon size={20} className={`${color} shrink-0`} />
      <div>
        <p className={`text-2xl font-black ${color}`}>{value}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{children}</p>
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
      // Si el horario de inicio es "futuro", el turno empezó ayer
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
