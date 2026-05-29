'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { QrCode, Play, MapPin, CheckCircle, Loader2, AlertCircle } from 'lucide-react'

interface Turno {
  id: string
  estado: string
  cliente_id: string | null
  clientes: { id: string; nombre_empresa: string } | null
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
}

export default function RondaIniciarClient({ turno, rondaActiva }: Props) {
  const router    = useRouter()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

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

  // Sin turno activo
  if (!turno) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <AlertCircle size={40} className="text-gray-200 mb-4" />
        <p className="font-bold text-gray-600 text-lg">Sin guardia activa</p>
        <p className="text-sm text-gray-400 mt-2">Necesitás tener un turno abierto para hacer una ronda.</p>
      </div>
    )
  }

  // Hay ronda activa sin completar → redirige
  if (rondaActiva) {
    const pct = rondaActiva.total_puntos > 0
      ? Math.round((rondaActiva.puntos_escaneados / rondaActiva.total_puntos) * 100)
      : 0

    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-black text-brand-ink">Ronda en curso</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {rondaActiva.clientes?.nombre_empresa}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Ronda #{rondaActiva.numero_ronda}</span>
            <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2.5 py-1 rounded-full">
              En curso
            </span>
          </div>

          {/* Barra de progreso */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="font-bold text-brand-ink">{pct}% completado</span>
              <span className="text-gray-400">{rondaActiva.puntos_escaneados}/{rondaActiva.total_puntos} puntos</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div
                className="h-3 rounded-full bg-brand-orange transition-all"
                style={{ width: `${pct}%` }}
              />
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
      </div>
    )
  }

  // Iniciar nueva ronda
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-brand-ink">Rondas</h1>
        <p className="text-sm text-gray-500 mt-0.5">Control de puntos de seguridad</p>
      </div>

      {/* Info del turno */}
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
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 rounded-2xl p-4 space-y-2">
        <p className="text-sm font-semibold text-blue-800">¿Cómo hacer una ronda?</p>
        <ol className="space-y-1.5 text-sm text-blue-700">
          <li className="flex items-start gap-2">
            <span className="font-bold shrink-0">1.</span>
            Pulsá "Iniciar ronda" para empezar el recorrido
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold shrink-0">2.</span>
            Andá a cada punto de control y escaneá el QR
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold shrink-0">3.</span>
            La ronda se completa cuando escaneás todos los puntos
          </li>
        </ol>
      </div>

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
          : <><Play size={22} fill="white" /> Iniciar ronda</>
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
