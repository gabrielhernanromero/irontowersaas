'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  QrCode, Play, MapPin, CheckCircle2, Loader2,
  AlertCircle, ShieldOff, Clock, ChevronDown, ChevronUp, Route,
} from 'lucide-react'

interface Turno {
  id: string
  estado: string
  cliente_id: string | null
  horario_inicio: string | null
  horario_fin: string | null
  created_at: string
  clientes: {
    id: string
    nombre_empresa: string
    frecuencia_ronda_minutos: number | null
    aviso_ronda_minutos: number | null
  } | null
}

interface RondaEnTurno {
  id: string
  numero_ronda: number
  hora_inicio: string
  hora_fin: string | null
  puntos_escaneados: number
  total_puntos: number
  completa: boolean
}

interface PuntoControl {
  id: string
  nombre: string
  ubicacion: string | null
  orden: number
}

interface RondaActiva {
  id: string
  numero_ronda: number
  hora_inicio: string
  total_puntos: number
  puntos_escaneados: number
  completa: boolean
  clientes: { id: string; nombre_empresa: string } | null
}

interface Props {
  turno: Turno | null
  rondaActiva: RondaActiva | null
  rondaEnCurso: boolean
  frecuenciaConfigurada: boolean
  totalPuntosActivos: number
  rondasDelTurno: RondaEnTurno[]
  puntosList: PuntoControl[]
}

// ── Helpers de tiempo ──────────────────────────────────────────────────────────

function toArgTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
}

function calcularDuracionMin(inicio: string, fin: string): number {
  return Math.round((new Date(fin).getTime() - new Date(inicio).getTime()) / 60_000)
}

function formatDuracion(min: number): string {
  if (min >= 60) {
    const h = Math.floor(min / 60)
    const m = min % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  return `${min}m`
}

// Calcula el horario programado de cada slot desde el created_at del turno
function calcularHoraSlot(turnoCreatedAt: string, slotIndex: number, frecuenciaMin: number): string {
  const ms = new Date(turnoCreatedAt).getTime() + slotIndex * frecuenciaMin * 60_000
  return new Date(ms).toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
}

// Calcula duración del turno en minutos desde horario_inicio/fin (maneja cruce de medianoche)
function calcularDuracionTurnoMin(horaInicio: string | null, horaFin: string | null): number {
  if (!horaInicio || !horaFin) return 12 * 60
  const [hi, mi] = horaInicio.split(':').map(Number)
  const [hf, mf] = horaFin.split(':').map(Number)
  let start = hi * 60 + mi
  let end   = hf * 60 + mf
  if (end <= start) end += 24 * 60
  return end - start
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function RondaIniciarClient({
  turno, rondaActiva, rondaEnCurso,
  frecuenciaConfigurada, totalPuntosActivos,
  rondasDelTurno, puntosList,
}: Props) {
  const router  = useRouter()
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState<string | null>(null)
  const [puntosExpanded, setPuntosExpanded] = useState(false)

  async function iniciarRonda() {
    if (!turno?.cliente_id) return
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/tecnico/ronda', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ turno_id: turno.id, cliente_id: turno.cliente_id }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al iniciar la ronda'); return }
      router.push(`/tecnico/ronda/${json.ronda.id}`)
    } catch { setError('Error de conexión') }
    finally  { setLoading(false) }
  }

  // ── Sin turno ──────────────────────────────────────────────────────────────
  if (!turno) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <AlertCircle size={40} className="text-gray-200 mb-4" />
        <p className="font-bold text-gray-600 text-lg">Sin guardia activa</p>
        <p className="text-sm text-gray-400 mt-2">Necesitás tener un turno abierto para hacer una ronda.</p>
      </div>
    )
  }

  // ── Sin configuración ──────────────────────────────────────────────────────
  if (!frecuenciaConfigurada || totalPuntosActivos === 0) {
    const sinFrecuencia = !frecuenciaConfigurada
    const sinPuntos     = totalPuntosActivos === 0
    const titulo  = sinFrecuencia && sinPuntos ? 'Rondas no habilitadas'
      : sinPuntos       ? 'Sin puntos de control'
      : 'Sin frecuencia configurada'
    const mensaje = sinFrecuencia && sinPuntos
      ? 'El supervisor no habilitó las rondas para este puesto. Contactá al supervisor.'
      : sinPuntos
        ? 'El supervisor aún no cargó los puntos de control para este puesto.'
        : 'El supervisor no configuró la frecuencia de rondas para este puesto.'

    return (
      <div className="space-y-5">
        <Header empresa={turno.clientes?.nombre_empresa} />
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <ShieldOff size={28} className="text-gray-400" />
          </div>
          <div>
            <p className="font-bold text-gray-700 text-lg">{titulo}</p>
            <p className="text-sm text-gray-400 mt-2 leading-relaxed">{mensaje}</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Ronda activa (en curso) ────────────────────────────────────────────────
  if (rondaActiva) {
    const pct = rondaActiva.total_puntos > 0
      ? Math.round((rondaActiva.puntos_escaneados / rondaActiva.total_puntos) * 100)
      : 0

    const frecuenciaMin = turno.clientes?.frecuencia_ronda_minutos ?? 0
    const duracionTurnoMin = calcularDuracionTurnoMin(turno.horario_inicio, turno.horario_fin)
    const totalRondas = frecuenciaMin > 0 ? Math.floor(duracionTurnoMin / frecuenciaMin) : 0
    const rondasHechas = rondasDelTurno.filter(r => r.completa).length

    // Próxima ronda después de esta
    const proximoSlotIdx = rondaActiva.numero_ronda // 0-based → ronda actual es idx (numero-1)
    const horaProxima = (frecuenciaMin > 0 && proximoSlotIdx < totalRondas)
      ? calcularHoraSlot(turno.created_at, proximoSlotIdx, frecuenciaMin)
      : null

    return (
      <div className="space-y-5">
        <Header empresa={rondaActiva.clientes?.nombre_empresa} subtitulo="Ronda en curso" />

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Ronda #{rondaActiva.numero_ronda}{totalRondas > 0 ? ` de ${totalRondas}` : ''}</span>
            <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2.5 py-1 rounded-full">
              En curso
            </span>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="font-bold text-brand-ink">{pct}% completado</span>
              <span className="text-gray-400">{rondaActiva.puntos_escaneados}/{rondaActiva.total_puntos} puntos</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div className="h-3 rounded-full bg-brand-orange transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <button
            onClick={() => router.push(`/tecnico/ronda/${rondaActiva.id}`)}
            className="w-full flex items-center justify-center gap-2 bg-brand-orange text-white font-bold py-4 rounded-2xl text-lg"
          >
            <QrCode size={22} />
            Continuar ronda
          </button>
        </div>

        {/* Progreso del turno */}
        {totalRondas > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Progreso del turno</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-brand-ink font-semibold">{rondasHechas} de {totalRondas} rondas completadas</span>
              {horaProxima && (
                <span className="flex items-center gap-1 text-gray-400 text-xs">
                  <Clock size={11} />
                  próxima {horaProxima}
                </span>
              )}
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full bg-teal-500 transition-all"
                style={{ width: `${Math.round((rondasHechas / totalRondas) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Ronda en curso por otro participante ───────────────────────────────────
  if (rondaEnCurso) {
    return (
      <div className="space-y-5">
        <Header empresa={turno.clientes?.nombre_empresa} />
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex flex-col items-center text-center gap-3">
          <QrCode size={36} className="text-amber-500" />
          <p className="font-bold text-amber-800">Ronda en curso</p>
          <p className="text-sm text-amber-700">
            Hay una ronda siendo realizada por otro técnico del turno. Esperá a que termine para iniciar la siguiente.
          </p>
        </div>
      </div>
    )
  }

  // ── Listo para iniciar ─────────────────────────────────────────────────────
  const frecuenciaMin    = turno.clientes?.frecuencia_ronda_minutos ?? 0
  const duracionTurnoMin = calcularDuracionTurnoMin(turno.horario_inicio, turno.horario_fin)
  const totalRondas      = frecuenciaMin > 0 ? Math.floor(duracionTurnoMin / frecuenciaMin) : 0
  const rondasHechas     = rondasDelTurno.filter(r => r.completa).length
  const proximaRondaNum  = rondasHechas + 1

  return (
    <div className="space-y-4">
      <Header empresa={turno.clientes?.nombre_empresa} />

      {/* Guardia activa */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Guardia activa</p>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="font-semibold text-brand-ink">
            {turno.clientes?.nombre_empresa ?? 'Puesto asignado'}
          </span>
          {turno.horario_inicio && (
            <span className="ml-auto text-xs text-gray-400">
              {turno.horario_inicio.slice(0, 5)}
              {turno.horario_fin ? ` → ${turno.horario_fin.slice(0, 5)}` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Programa de rondas */}
      {totalRondas > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Route size={15} className="text-teal-600" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Programa — {totalRondas} rondas en el turno
              </p>
            </div>
            <span className="text-xs text-gray-400">{rondasHechas}/{totalRondas} hechas</span>
          </div>

          <div className="divide-y divide-gray-50 px-4 pb-2">
            {Array.from({ length: totalRondas }, (_, i) => {
              const num        = i + 1
              const rondaHecha = rondasDelTurno.find(r => r.numero_ronda === num)
              const horaSlot   = calcularHoraSlot(turno.created_at, i, frecuenciaMin)
              const esProxima  = num === proximaRondaNum
              const esFutura   = num > proximaRondaNum

              return (
                <div key={num} className="flex items-center gap-3 py-2.5">
                  {/* Estado visual */}
                  {rondaHecha?.completa ? (
                    <CheckCircle2 size={18} className="text-teal-500 shrink-0" />
                  ) : esProxima ? (
                    <div className="w-[18px] h-[18px] rounded-full border-2 border-brand-orange bg-orange-50 shrink-0" />
                  ) : (
                    <div className="w-[18px] h-[18px] rounded-full border-2 border-gray-200 shrink-0" />
                  )}

                  <span className={`text-sm ${rondaHecha?.completa ? 'text-gray-400' : esProxima ? 'font-bold text-brand-ink' : 'text-gray-400'}`}>
                    Ronda #{num}
                  </span>

                  <span className={`flex items-center gap-1 text-xs ml-auto ${rondaHecha?.completa ? 'text-gray-400' : esProxima ? 'text-brand-orange font-semibold' : 'text-gray-300'}`}>
                    <Clock size={11} />
                    {horaSlot}
                  </span>

                  {/* Duración si completada */}
                  {rondaHecha?.completa && rondaHecha.hora_fin && (
                    <span className="text-xs text-teal-600 font-medium w-10 text-right">
                      {formatDuracion(calcularDuracionMin(rondaHecha.hora_inicio, rondaHecha.hora_fin))}
                    </span>
                  )}

                  {/* Badge próxima */}
                  {esProxima && !rondaHecha && (
                    <span className="text-[10px] font-bold bg-orange-100 text-brand-orange px-2 py-0.5 rounded-full">
                      siguiente
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Puntos de control */}
      {puntosList.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setPuntosExpanded(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 active:bg-gray-50"
          >
            <div className="flex items-center gap-2">
              <MapPin size={15} className="text-brand-blue" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Puntos de control — {puntosList.length} {puntosList.length === 1 ? 'punto' : 'puntos'}
              </span>
            </div>
            {puntosExpanded
              ? <ChevronUp size={16} className="text-gray-400" />
              : <ChevronDown size={16} className="text-gray-400" />
            }
          </button>

          {puntosExpanded && (
            <div className="divide-y divide-gray-50 px-4 pb-3">
              {puntosList.map((p, idx) => (
                <div key={p.id} className="flex items-start gap-3 py-2.5">
                  <span className="text-xs text-gray-300 font-mono w-5 shrink-0 mt-0.5">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-brand-ink truncate">{p.nombre}</p>
                    {p.ubicacion && (
                      <p className="text-xs text-gray-400 truncate">{p.ubicacion}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        onClick={iniciarRonda}
        disabled={loading || !turno.cliente_id}
        className="w-full flex items-center justify-center gap-3 bg-brand-orange text-white font-black py-5 rounded-2xl text-xl disabled:opacity-60 active:scale-95 transition-transform"
      >
        {loading
          ? <><Loader2 size={22} className="animate-spin" /> Iniciando...</>
          : <><Play size={22} fill="white" /> Iniciar ronda #{proximaRondaNum}</>
        }
      </button>

      {!turno.cliente_id && (
        <p className="text-center text-xs text-gray-400">
          Tu turno no tiene un cliente asignado. Contactá al supervisor.
        </p>
      )}
    </div>
  )
}

// ── Sub-componente header ──────────────────────────────────────────────────────

function Header({ empresa, subtitulo }: { empresa?: string; subtitulo?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-black text-brand-ink">
        {subtitulo ?? 'Rondas'}
      </h1>
      <p className="text-sm text-gray-500 mt-0.5">
        {empresa ?? 'Control de puntos de seguridad'}
      </p>
    </div>
  )
}
