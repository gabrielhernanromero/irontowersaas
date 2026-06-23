'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  CheckCircle, XCircle, Clock, ChevronDown, ChevronUp,
  Building2, QrCode, RefreshCw, User, AlertTriangle,
  MapPin, Bell, Route, Camera, AlertCircle, Download,
} from 'lucide-react'
import { downloadCsv } from '@/lib/exportCsv'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Scan {
  id: string
  punto_control_id: string
  escaneado_at: string
  novedad_id: string | null
  foto_url: string | null
  puntos_control: { id: string; nombre: string; ubicacion: string | null } | null
}

interface Ronda {
  id: string
  turno_id: string | null
  tecnico_id: string
  cliente_id: string
  numero_ronda: number
  hora_inicio: string
  hora_fin: string | null
  total_puntos: number
  puntos_escaneados: number
  completa: boolean
  clientes: { id: string; nombre_empresa: string } | null
  tecnico: { id: string; nombre: string; apellido: string } | null
  ronda_scans: Scan[]
}

interface PuntoControl {
  id: string
  nombre: string
  ubicacion: string | null
  orden: number
  activo: boolean
  codigo_qr: string
}

interface EsquemaCobertura {
  id: string
  hora_inicio: string
  hora_fin: string
  activo: boolean
  dias_semana: number[]
}

interface Ruta {
  id: string
  nombre_empresa: string
  frecuencia_ronda_minutos: number | null
  aviso_ronda_minutos: number | null
  puntos_control: PuntoControl[]
  esquemas_cobertura: EsquemaCobertura[]
}

interface Props {
  initialRondas: Ronda[]
  clientes: { id: string; nombre_empresa: string }[]
  tecnicos: { id: string; nombre: string; apellido: string }[]
  rutas: Ruta[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  return new Date(iso).toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
}

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
}

function fechaAR(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
  })
}

function todayAR(): string {
  return new Date().toLocaleDateString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
  })
}

function isoHoy(): string {
  return new Date().toLocaleDateString('sv-SE', {
    timeZone: 'America/Argentina/Buenos_Aires',
  })
}

function isoHace(dias: number): string {
  return new Date(Date.now() - dias * 86400000).toLocaleDateString('sv-SE', {
    timeZone: 'America/Argentina/Buenos_Aires',
  })
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

function currentMinutesAR(): number {
  const t = new Date().toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires',
  })
  return timeToMinutes(t)
}

function getDayAR(): number {
  // 0=Domingo, 1=Lunes, ..., 6=Sábado en hora Argentina
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' })
  ).getDay()
}

function enAlgunTurno(esquemas: EsquemaCobertura[]): boolean {
  const diaActual = getDayAR()
  const minutosActuales = currentMinutesAR()
  return esquemas.filter(e => e.activo).some(e => {
    const dias = e.dias_semana ?? [0,1,2,3,4,5,6]
    if (!dias.includes(diaActual)) return false          // no aplica hoy
    const ini = timeToMinutes(e.hora_inicio)
    const fin = timeToMinutes(e.hora_fin)
    if (fin > ini) return minutosActuales >= ini && minutosActuales < fin   // turno normal
    if (fin < ini) return minutosActuales >= ini || minutosActuales < fin   // nocturno cruzando medianoche
    return false
  })
}

function frecLabel(mins: number | null): string {
  if (!mins) return 'Sin configurar'
  if (mins < 60) return `Cada ${mins} min`
  if (mins === 60) return 'Cada 1 hora'
  if (mins % 60 === 0) return `Cada ${mins / 60} horas`
  return `Cada ${Math.floor(mins / 60)}h ${mins % 60}min`
}

type EstadoRonda = 'en_curso' | 'completa' | 'incompleta'

function estadoRonda(r: Ronda): EstadoRonda {
  if (!r.hora_fin) return 'en_curso'
  return r.completa ? 'completa' : 'incompleta'
}

// ── Componente principal ──────────────────────────────────────────────────────

const REFRESH_INTERVAL = 60 // segundos

export default function RondasSupervisorClient({ initialRondas, clientes, tecnicos, rutas }: Props) {
  const [rondas,     setRondas]     = useState(initialRondas)
  const [tab,        setTab]        = useState<'hoy' | 'historial' | 'rutas'>('hoy')
  const [refreshing, setRefreshing] = useState(false)
  const [countdown,  setCountdown]  = useState(REFRESH_INTERVAL)
  const [expanded,   setExpanded]   = useState<string | null>(null)
  const [fotoAbierta, setFotoAbierta] = useState<string | null>(null)

  // Filtros Hoy
  const [hoyCliente, setHoyCliente] = useState('all')

  // Filtros Historial
  const [desde,       setDesde]       = useState(isoHace(7))
  const [hasta,       setHasta]       = useState(isoHoy())
  const [histCliente, setHistCliente] = useState('all')
  const [histTecnico, setHistTecnico] = useState('all')
  const [histEstado,  setHistEstado]  = useState<'all' | EstadoRonda>('all')

  // ── Auto-refresh (solo en tab Hoy) ──────────────────────────────────────────
  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const res  = await fetch('/api/supervisor/rondas')
      const json = await res.json()
      if (json.rondas) setRondas(json.rondas)
    } finally {
      setRefreshing(false)
      setCountdown(REFRESH_INTERVAL)
    }
  }, [])

  useEffect(() => {
    if (tab !== 'hoy') return
    setCountdown(REFRESH_INTERVAL)
    const tick = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { refresh(); return REFRESH_INTERVAL }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [tab, refresh])

  // ── Filtrado HOY ─────────────────────────────────────────────────────────────
  const rondasHoy = useMemo(() => rondas.filter(r => {
    if (fechaAR(r.hora_inicio) !== todayAR()) return false
    if (hoyCliente !== 'all' && r.cliente_id !== hoyCliente) return false
    return true
  }), [rondas, hoyCliente])

  // ── Alertas de rondas vencidas ───────────────────────────────────────────────
  type AlertaVencida = { ruta: Ruta; tipo: 'sin_ronda' | 'vencida'; minutosDesde: number | null }

  const alertasVencidas = useMemo<AlertaVencida[]>(() => {
    const ahora = Date.now()
    const resultado: AlertaVencida[] = []

    for (const ruta of rutas) {
      if (!ruta.frecuencia_ronda_minutos) continue
      if (!ruta.puntos_control.some(p => p.activo)) continue

      // Solo alertar si la hora actual cae dentro de algún turno configurado
      if (!enAlgunTurno(ruta.esquemas_cobertura)) continue

      const frecMin = ruta.frecuencia_ronda_minutos
      const rondasCliente = rondas
        .filter(r => r.cliente_id === ruta.id && fechaAR(r.hora_inicio) === todayAR())
        .sort((a, b) => new Date(b.hora_inicio).getTime() - new Date(a.hora_inicio).getTime())

      if (rondasCliente.find(r => !r.hora_fin)) continue // hay ronda activa

      const ultima = rondasCliente[0]
      if (!ultima) {
        resultado.push({ ruta, tipo: 'sin_ronda', minutosDesde: null })
        continue
      }

      const minutosDesde = (ahora - new Date(ultima.hora_fin!).getTime()) / 60000
      if (minutosDesde > frecMin) {
        resultado.push({ ruta, tipo: 'vencida', minutosDesde: Math.round(minutosDesde) })
      }
    }
    return resultado
  }, [rutas, rondas])

  // ── Filtrado HISTORIAL ───────────────────────────────────────────────────────
  const rondasHist = useMemo(() => rondas.filter(r => {
    const fecha = r.hora_inicio.slice(0, 10)
    if (fecha < desde || fecha > hasta)                          return false
    if (histCliente !== 'all' && r.cliente_id !== histCliente)  return false
    if (histTecnico !== 'all' && r.tecnico_id !== histTecnico)  return false
    if (histEstado  !== 'all' && estadoRonda(r) !== histEstado) return false
    return true
  }), [rondas, desde, hasta, histCliente, histTecnico, histEstado])

  const filtradas = tab === 'hoy' ? rondasHoy : rondasHist

  // ── Export CSV ───────────────────────────────────────────────────────────────
  function exportarCsv() {
    const rows = rondasHist.map(r => ({
      Fecha:         r.hora_inicio.slice(0, 10),
      'Hora inicio': formatHora(r.hora_inicio),
      'Hora fin':    r.hora_fin ? formatHora(r.hora_fin) : '',
      Duración:      duracion(r.hora_inicio, r.hora_fin),
      Cliente:       r.clientes?.nombre_empresa ?? '',
      Técnico:       r.tecnico ? `${r.tecnico.apellido}, ${r.tecnico.nombre}` : '',
      'Ronda Nº':    r.numero_ronda,
      Estado:        estadoRonda(r) === 'completa' ? 'Completa' : estadoRonda(r) === 'en_curso' ? 'En curso' : 'Incompleta',
      'Puntos escaneados': r.puntos_escaneados,
      'Total puntos':      r.total_puntos,
      '% Cumplimiento':    pct(r.puntos_escaneados, r.total_puntos),
    }))
    downloadCsv(rows, 'rondas')
  }

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total       = filtradas.length
    const completas   = filtradas.filter(r => r.completa).length
    const enCurso     = filtradas.filter(r => !r.hora_fin).length
    const cumplimiento = total === 0 ? 0 : Math.round(
      filtradas.reduce((acc, r) => acc + pct(r.puntos_escaneados, r.total_puntos), 0) / total
    )
    return { total, completas, enCurso, cumplimiento }
  }, [filtradas])

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Lightbox foto */}
      {fotoAbierta && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setFotoAbierta(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fotoAbierta} alt="Foto del scan" className="max-h-[90vh] max-w-full rounded-xl object-contain" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          { key: 'hoy',       label: 'Hoy'      },
          { key: 'historial', label: 'Historial' },
          { key: 'rutas',     label: 'Rutas'     },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === t.key
                ? 'bg-white shadow-sm text-brand-ink'
                : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
            {t.key === 'hoy' && alertasVencidas.length > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                {alertasVencidas.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Filtros HOY ───────────────────────────────────────────────────────── */}
      {tab === 'hoy' && (
        <div className="flex gap-2 items-center flex-wrap">
          <select value={hoyCliente} onChange={e => setHoyCliente(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white shadow-sm">
            <option value="all">Todos los clientes</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre_empresa}</option>)}
          </select>

          <button onClick={() => { refresh() }} disabled={refreshing}
            className="flex items-center gap-2 text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white shadow-sm text-gray-600 hover:bg-gray-50 disabled:opacity-60 transition-colors">
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Actualizar
          </button>
          <span className="text-xs text-gray-400">
            Actualización automática en {countdown}s
          </span>
        </div>
      )}

      {/* ── Alertas vencidas ──────────────────────────────────────────────────── */}
      {tab === 'hoy' && alertasVencidas.length > 0 && (
        <div className="space-y-2">
          {alertasVencidas.map((alerta) => { const { ruta, tipo, minutosDesde } = alerta; return (
            <div key={ruta.id}
              className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-red-800">{ruta.nombre_empresa}</p>
                <p className="text-xs text-red-600 mt-0.5">
                  {tipo === 'sin_ronda'
                    ? `Sin rondas hoy — frecuencia configurada: ${frecLabel(ruta.frecuencia_ronda_minutos)}`
                    : `Ronda vencida — última hace ${minutosDesde} min (frecuencia: ${frecLabel(ruta.frecuencia_ronda_minutos)})`
                  }
                </p>
              </div>
            </div>
          )})}
        </div>
      )}

      {/* ── Filtros HISTORIAL ─────────────────────────────────────────────────── */}
      {tab === 'historial' && (
        <div className="flex gap-2 flex-wrap items-center">
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} max={hasta}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white shadow-sm" />
          <span className="text-gray-400 text-sm">→</span>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
            min={desde} max={isoHoy()}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white shadow-sm" />

          <select value={histCliente} onChange={e => setHistCliente(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white shadow-sm">
            <option value="all">Todos los clientes</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre_empresa}</option>)}
          </select>

          <select value={histTecnico} onChange={e => setHistTecnico(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white shadow-sm">
            <option value="all">Todos los técnicos</option>
            {tecnicos.map(t => <option key={t.id} value={t.id}>{t.apellido}, {t.nombre}</option>)}
          </select>

          <select value={histEstado} onChange={e => setHistEstado(e.target.value as typeof histEstado)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white shadow-sm">
            <option value="all">Todos los estados</option>
            <option value="completa">Completas</option>
            <option value="incompleta">Incompletas</option>
            <option value="en_curso">En curso</option>
          </select>

          <button
            onClick={exportarCsv}
            disabled={rondasHist.length === 0}
            className="flex items-center gap-2 text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white shadow-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors ml-auto"
          >
            <Download size={13} />
            Exportar CSV
          </button>
        </div>
      )}

      {/* ── KPIs ──────────────────────────────────────────────────────────────── */}
      {tab !== 'rutas' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total rondas',   value: kpis.total,             color: 'text-gray-700'    },
            { label: 'En curso',       value: kpis.enCurso,           color: 'text-amber-600'   },
            { label: 'Completas',      value: kpis.completas,         color: 'text-emerald-600' },
            { label: '% Cumplimiento', value: `${kpis.cumplimiento}%`,
              color: kpis.cumplimiento >= 90 ? 'text-emerald-600' : kpis.cumplimiento >= 70 ? 'text-amber-500' : 'text-red-500' },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className={`text-3xl font-black ${k.color}`}>{k.value}</p>
              <p className="text-sm text-gray-500 mt-1">{k.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Lista de rondas ───────────────────────────────────────────────────── */}
      {tab !== 'rutas' && (filtradas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <QrCode size={28} className="mx-auto mb-3 text-gray-200" />
          <p className="text-sm text-gray-400">
            {tab === 'hoy' ? 'Sin rondas registradas hoy' : 'Sin rondas en el período seleccionado'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-50">
            {filtradas.map(ronda => {
              const p      = pct(ronda.puntos_escaneados, ronda.total_puntos)
              const isOpen = expanded === ronda.id
              const estado = estadoRonda(ronda)
              const barColor = p >= 90 ? 'bg-emerald-500' : p >= 70 ? 'bg-amber-400' : 'bg-red-500'

              return (
                <div key={ronda.id}>
                  {/* Fila principal */}
                  <div
                    className="px-4 py-3.5 hover:bg-gray-50/50 cursor-pointer transition-colors"
                    onClick={() => setExpanded(isOpen ? null : ronda.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <Building2 size={12} className="text-gray-400 shrink-0" />
                            <p className="text-sm font-semibold text-gray-800 truncate">
                              {ronda.clientes?.nombre_empresa ?? '—'}
                            </p>
                          </div>
                          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md shrink-0">
                            Ronda #{ronda.numero_ronda}
                          </span>
                          {estado === 'en_curso' && (
                            <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                              <Clock size={10} /> En curso
                            </span>
                          )}
                          {estado === 'completa' && (
                            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                              <CheckCircle size={10} /> Completa
                            </span>
                          )}
                          {estado === 'incompleta' && (
                            <span className="flex items-center gap-1 text-xs font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                              <XCircle size={10} /> Incompleta
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {ronda.tecnico && (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <User size={10} className="text-gray-400" />
                              {ronda.tecnico.apellido}, {ronda.tecnico.nombre}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            {tab === 'historial' && `${formatFecha(ronda.hora_inicio)} · `}
                            {formatHora(ronda.hora_inicio)}
                            {ronda.hora_fin
                              ? ` → ${formatHora(ronda.hora_fin)} (${duracion(ronda.hora_inicio, ronda.hora_fin)})`
                              : ' → en curso'}
                          </span>
                        </div>
                      </div>

                      {/* Barra + chevron */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="hidden sm:block w-28">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-gray-700">{p}%</span>
                            <span className="text-xs text-gray-400">{ronda.puntos_escaneados}/{ronda.total_puntos}</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full transition-all ${barColor}`} style={{ width: `${p}%` }} />
                          </div>
                        </div>
                        {isOpen
                          ? <ChevronUp size={15} className="text-gray-400" />
                          : <ChevronDown size={15} className="text-gray-400" />}
                      </div>
                    </div>

                    {/* Barra móvil */}
                    <div className="sm:hidden mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-gray-700">{p}%</span>
                        <span className="text-xs text-gray-400">{ronda.puntos_escaneados}/{ronda.total_puntos} puntos</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${p}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* Detalle de scans */}
                  {isOpen && (
                    <div className="px-4 pb-4 pt-3 bg-gray-50/50 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                        Puntos de control escaneados
                      </p>
                      {ronda.ronda_scans.length === 0 ? (
                        <p className="text-sm text-gray-400 italic">Sin escaneos registrados.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {ronda.ronda_scans.map((scan, i) => (
                            <div key={scan.id}
                              className={`bg-white rounded-lg border p-2.5 ${
                                scan.novedad_id ? 'border-amber-200' : 'border-gray-100'
                              }`}>
                              <div className="flex items-center gap-2">
                                <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-semibold text-gray-700 truncate">
                                    {scan.puntos_control?.nombre ?? `Punto ${i + 1}`}
                                  </p>
                                  <p className="text-xs text-gray-400">{formatHora(scan.escaneado_at)}</p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {scan.novedad_id && (
                                    <AlertTriangle size={13} className="text-amber-500" aria-label="Con novedad" />
                                  )}
                                  {scan.foto_url && (
                                    <button
                                      onClick={e => { e.stopPropagation(); setFotoAbierta(scan.foto_url!) }}
                                      className="text-gray-400 hover:text-brand-orange transition-colors"
                                      aria-label="Ver foto"
                                    >
                                      <Camera size={13} />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Miniatura de foto */}
                              {scan.foto_url && (
                                <button
                                  onClick={e => { e.stopPropagation(); setFotoAbierta(scan.foto_url!) }}
                                  className="mt-2 w-full block overflow-hidden rounded-md"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={scan.foto_url}
                                    alt="Foto del checkpoint"
                                    className="w-full h-20 object-cover hover:opacity-90 transition-opacity"
                                  />
                                </button>
                              )}
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
      ))}

      {/* ── Tab RUTAS ─────────────────────────────────────────────────────────── */}
      {tab === 'rutas' && (
        <div className="space-y-4">
          {rutas.filter(r => r.puntos_control.length > 0 || r.frecuencia_ronda_minutos).length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <Route size={28} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm text-gray-400">Ningún cliente tiene rutas configuradas todavía.</p>
              <p className="text-xs text-gray-400 mt-1">Configurá los puntos de control desde la sección Clientes.</p>
            </div>
          ) : (
            rutas
              .filter(r => r.puntos_control.length > 0 || r.frecuencia_ronda_minutos)
              .map(ruta => {
                const puntosActivos = ruta.puntos_control
                  .filter(p => p.activo)
                  .sort((a, b) => a.orden - b.orden)

                return (
                  <div key={ruta.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Building2 size={15} className="text-gray-400 shrink-0" />
                        <h3 className="font-semibold text-gray-800">{ruta.nombre_empresa}</h3>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="flex items-center gap-1.5 text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">
                          <Clock size={11} />
                          {frecLabel(ruta.frecuencia_ronda_minutos)}
                        </span>
                        {ruta.aviso_ronda_minutos && (
                          <span className="flex items-center gap-1.5 text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">
                            <Bell size={11} />
                            Alerta {ruta.aviso_ronda_minutos} min antes
                          </span>
                        )}
                        <span className="flex items-center gap-1.5 text-brand-orange bg-brand-orange/10 px-2.5 py-1 rounded-full font-semibold">
                          <QrCode size={11} />
                          {puntosActivos.length} punto{puntosActivos.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    {puntosActivos.length === 0 ? (
                      <p className="px-5 py-4 text-sm text-gray-400 italic">Sin puntos de control activos.</p>
                    ) : (
                      <div className="px-5 py-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {puntosActivos.map((punto, i) => (
                            <div key={punto.id} className="flex items-center gap-2.5 bg-gray-50 rounded-xl p-3 border border-gray-100">
                              <span className="w-6 h-6 rounded-full bg-brand-orange/10 text-brand-orange text-xs font-bold flex items-center justify-center shrink-0">
                                {i + 1}
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">{punto.nombre}</p>
                                {punto.ubicacion && (
                                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5 truncate">
                                    <MapPin size={9} /> {punto.ubicacion}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
          )}
        </div>
      )}
    </div>
  )
}
