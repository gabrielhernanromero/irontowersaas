'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle, AlertTriangle, Loader2, MapPin,
  ArrowRight, QrCode, ThumbsUp, AlertCircle, ChevronDown,
} from 'lucide-react'

interface Punto {
  id: string
  nombre: string
  ubicacion: string | null
  cliente_id: string
  clientes: { id: string; nombre_empresa: string } | null
}

interface RondaActiva {
  id: string
  numero_ronda: number
  puntos_escaneados: number
  total_puntos: number
  cliente_id: string
}

interface Props {
  codigoQr:    string
  punto:       Punto
  rondaActiva: RondaActiva | null
}

type ScanEstado   = 'idle' | 'scanning' | 'ok' | 'ya_escaneado' | 'sin_ronda' | 'error'
type NovedadEstado = 'pending' | 'form' | 'submitting' | 'done'

type Severidad = 'bajo' | 'medio' | 'alto'

const SEVERIDAD_LABELS: Record<Severidad, { label: string; color: string }> = {
  bajo:  { label: 'Bajo',  color: 'border-yellow-400 bg-yellow-50 text-yellow-800' },
  medio: { label: 'Medio', color: 'border-orange-400 bg-orange-50 text-orange-800' },
  alto:  { label: 'Alto',  color: 'border-red-500 bg-red-50 text-red-800' },
}

export default function ScanResultClient({ codigoQr, punto, rondaActiva }: Props) {
  const router = useRouter()

  // Scan state
  const [estado,     setEstado]     = useState<ScanEstado>('idle')
  const [mensaje,    setMensaje]    = useState<string | null>(null)
  const [escaneados, setEscaneados] = useState(rondaActiva?.puntos_escaneados ?? 0)
  const [total,      setTotal]      = useState(rondaActiva?.total_puntos ?? 0)
  const [scanId,     setScanId]     = useState<string | null>(null)
  const [rondaCompleta, setRondaCompleta] = useState(false)

  // Novedad state
  const [novedadEstado,  setNovedadEstado]  = useState<NovedadEstado>('pending')
  const [descripcion,    setDescripcion]    = useState('')
  const [esIncidencia,   setEsIncidencia]   = useState(false)
  const [severidad,      setSeveridad]      = useState<Severidad>('medio')
  const [novedadError,   setNovedadError]   = useState<string | null>(null)

  useEffect(() => {
    if (rondaActiva) {
      ejecutarScan()
    } else {
      setEstado('sin_ronda')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function ejecutarScan() {
    if (!rondaActiva) { setEstado('sin_ronda'); return }
    setEstado('scanning')

    try {
      const res  = await fetch(`/api/tecnico/ronda/${rondaActiva.id}/scan`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ codigo_qr: codigoQr }),
      })
      const json = await res.json()

      if (res.status === 409 && json.yaEscaneado) {
        setEstado('ya_escaneado')
        setMensaje('Este punto ya fue escaneado en esta ronda.')
        return
      }

      if (!res.ok) {
        setEstado('error')
        setMensaje(json.error ?? 'Error al registrar el escaneo')
        return
      }

      setScanId(json.scan?.id ?? null)
      setEscaneados(json.escaneados)
      setTotal(json.total)
      setRondaCompleta(json.rondaCompleta)
      setEstado('ok')
    } catch {
      setEstado('error')
      setMensaje('Error de conexión. Intentá de nuevo.')
    }
  }

  async function registrarNovedad() {
    if (!rondaActiva || !scanId) return
    setNovedadEstado('submitting')
    setNovedadError(null)

    try {
      const res = await fetch(`/api/tecnico/ronda/${rondaActiva.id}/novedad`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          scan_id:              scanId,
          descripcion,
          es_incidencia:        esIncidencia,
          incidencia_severidad: esIncidencia ? severidad : undefined,
        }),
      })
      const json = await res.json()

      if (!res.ok) {
        setNovedadError(json.error ?? 'Error al guardar la novedad')
        setNovedadEstado('form')
        return
      }

      setNovedadEstado('done')
      setTimeout(() => router.push(`/tecnico/ronda/${rondaActiva.id}`), 1400)
    } catch {
      setNovedadError('Error de conexión')
      setNovedadEstado('form')
    }
  }

  function continuar() {
    if (!rondaActiva) return
    router.push(`/tecnico/ronda/${rondaActiva.id}`)
  }

  const pct = total > 0 ? Math.round((escaneados / total) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">

        {/* ── Scanning ── */}
        {estado === 'scanning' && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center space-y-4">
            <Loader2 size={44} className="animate-spin text-brand-orange mx-auto" />
            <p className="font-bold text-brand-ink text-lg">Registrando escaneo...</p>
          </div>
        )}

        {/* ── OK ── */}
        {estado === 'ok' && (
          <>
            <div className="bg-emerald-50 rounded-3xl border border-emerald-200 p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <CheckCircle size={36} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-black text-emerald-700">¡Escaneado!</p>
                <p className="text-sm text-emerald-600 mt-1">{punto.nombre}</p>
                {punto.ubicacion && (
                  <p className="flex items-center justify-center gap-1 text-xs text-emerald-500 mt-0.5">
                    <MapPin size={11} /> {punto.ubicacion}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-emerald-700">{pct}%</span>
                  <span className="text-emerald-600">{escaneados}/{total} puntos</span>
                </div>
                <div className="w-full bg-emerald-100 rounded-full h-2.5">
                  <div className="h-2.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>

            {/* ── Formulario novedad ── */}
            {novedadEstado === 'form' && (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 space-y-4">
                <p className="font-bold text-brand-ink text-base">¿Qué encontraste?</p>

                <textarea
                  value={descripcion}
                  onChange={e => setDescripcion(e.target.value)}
                  placeholder="Describí la situación encontrada..."
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-brand-ink placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-orange resize-none"
                />

                {/* Toggle incidencia */}
                <button
                  type="button"
                  onClick={() => setEsIncidencia(v => !v)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-semibold transition-colors ${
                    esIncidencia
                      ? 'border-orange-400 bg-orange-50 text-orange-800'
                      : 'border-gray-200 bg-gray-50 text-gray-600'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <AlertCircle size={16} />
                    Generar incidencia
                  </span>
                  <ChevronDown
                    size={16}
                    className={`transition-transform ${esIncidencia ? 'rotate-180' : ''}`}
                  />
                </button>

                {/* Selector de severidad */}
                {esIncidencia && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Severidad</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(Object.entries(SEVERIDAD_LABELS) as [Severidad, { label: string; color: string }][]).map(([key, { label, color }]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSeveridad(key)}
                          className={`py-2.5 rounded-xl border-2 text-xs font-bold transition-all ${
                            severidad === key ? color : 'border-gray-200 bg-white text-gray-400'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {novedadError && (
                  <p className="text-xs text-red-600">{novedadError}</p>
                )}

                <button
                  onClick={registrarNovedad}
                  disabled={descripcion.trim().length < 3 || novedadEstado === 'submitting'}
                  className="w-full flex items-center justify-center gap-2 bg-brand-orange text-white font-bold py-4 rounded-2xl disabled:opacity-50 active:scale-95 transition-transform"
                >
                  {novedadEstado === 'submitting'
                    ? <><Loader2 size={18} className="animate-spin" /> Guardando...</>
                    : 'Guardar y continuar'
                  }
                </button>
              </div>
            )}

            {/* ── Confirmación novedad guardada ── */}
            {novedadEstado === 'done' && (
              <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 text-center">
                <p className="font-bold text-amber-700 text-sm">
                  {esIncidencia ? 'Incidencia registrada en el libro de guardia' : 'Novedad registrada en el libro de guardia'}
                </p>
                <p className="text-xs text-amber-600 mt-1">Volviendo a la ronda...</p>
              </div>
            )}

            {/* ── Botones de acción (estado initial pending) ── */}
            {novedadEstado === 'pending' && !rondaCompleta && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={continuar}
                  className="flex items-center justify-center gap-2 bg-emerald-600 text-white font-bold py-4 rounded-2xl active:scale-95 transition-transform text-sm"
                >
                  <ThumbsUp size={16} />
                  Sin novedad
                </button>
                <button
                  onClick={() => setNovedadEstado('form')}
                  className="flex items-center justify-center gap-2 border-2 border-amber-400 bg-amber-50 text-amber-800 font-bold py-4 rounded-2xl active:scale-95 transition-transform text-sm"
                >
                  <AlertCircle size={16} />
                  Hay novedad
                </button>
              </div>
            )}

            {novedadEstado === 'pending' && rondaCompleta && (
              <div className="space-y-3">
                <p className="text-center text-sm font-bold text-emerald-700">¡Ronda completada!</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={continuar}
                    className="flex items-center justify-center gap-2 bg-emerald-600 text-white font-bold py-4 rounded-2xl active:scale-95 transition-transform text-sm"
                  >
                    <ThumbsUp size={16} />
                    Sin novedad
                  </button>
                  <button
                    onClick={() => setNovedadEstado('form')}
                    className="flex items-center justify-center gap-2 border-2 border-amber-400 bg-amber-50 text-amber-800 font-bold py-4 rounded-2xl active:scale-95 transition-transform text-sm"
                  >
                    <AlertCircle size={16} />
                    Hay novedad
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Ya escaneado ── */}
        {estado === 'ya_escaneado' && (
          <div className="bg-amber-50 rounded-3xl border border-amber-200 p-8 text-center space-y-4">
            <AlertTriangle size={44} className="text-amber-500 mx-auto" />
            <div>
              <p className="text-xl font-black text-amber-700">Ya escaneado</p>
              <p className="text-sm text-amber-600 mt-2">{mensaje}</p>
              <p className="text-xs text-amber-500 mt-1">{punto.nombre}</p>
            </div>
          </div>
        )}

        {/* ── Sin ronda ── */}
        {estado === 'sin_ronda' && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center space-y-4">
            <QrCode size={44} className="text-gray-300 mx-auto" />
            <div>
              <p className="text-xl font-black text-gray-700">Sin ronda activa</p>
              <p className="text-sm text-gray-500 mt-2">
                Necesitás iniciar una ronda antes de escanear puntos de control.
              </p>
              <p className="text-xs text-gray-400 mt-1 font-semibold">{punto.nombre}</p>
            </div>
            <button
              onClick={() => router.push('/tecnico/ronda')}
              className="w-full flex items-center justify-center gap-2 bg-brand-orange text-white font-bold py-3.5 rounded-2xl"
            >
              Ir a Rondas <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* ── Error ── */}
        {estado === 'error' && (
          <div className="bg-red-50 rounded-3xl border border-red-200 p-8 text-center space-y-4">
            <AlertTriangle size={44} className="text-red-500 mx-auto" />
            <div>
              <p className="text-xl font-black text-red-700">Error</p>
              <p className="text-sm text-red-600 mt-2">{mensaje}</p>
            </div>
            <button
              onClick={ejecutarScan}
              className="w-full bg-red-600 text-white font-bold py-3.5 rounded-2xl"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* ── Info del punto (siempre visible salvo scanning) ── */}
        {estado !== 'scanning' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Punto escaneado</p>
            <p className="font-bold text-brand-ink">{punto.nombre}</p>
            {punto.clientes && (
              <p className="text-xs text-gray-400 mt-0.5">{punto.clientes.nombre_empresa}</p>
            )}
          </div>
        )}

        {/* ── Link volver a la ronda (ya_escaneado) ── */}
        {estado === 'ya_escaneado' && rondaActiva && (
          <button
            onClick={continuar}
            className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-600 font-semibold py-3.5 rounded-2xl bg-white"
          >
            Ver ronda completa <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
