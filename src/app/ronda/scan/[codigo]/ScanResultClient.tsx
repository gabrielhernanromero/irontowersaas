'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, AlertTriangle, Loader2, MapPin, ArrowRight, QrCode } from 'lucide-react'

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

type Estado = 'idle' | 'scanning' | 'ok' | 'ya_escaneado' | 'sin_ronda' | 'error'

export default function ScanResultClient({ codigoQr, punto, rondaActiva }: Props) {
  const router = useRouter()
  const [estado,     setEstado]     = useState<Estado>('idle')
  const [mensaje,    setMensaje]    = useState<string | null>(null)
  const [escaneados, setEscaneados] = useState(rondaActiva?.puntos_escaneados ?? 0)
  const [total,      setTotal]      = useState(rondaActiva?.total_puntos      ?? 0)

  // Auto-escanear al cargar si hay ronda activa
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

      setEscaneados(json.escaneados)
      setTotal(json.total)
      setEstado('ok')

      // Si la ronda se completó, redirige a la vista de ronda
      if (json.rondaCompleta) {
        setTimeout(() => router.push(`/tecnico/ronda/${rondaActiva.id}`), 1800)
      }
    } catch {
      setEstado('error')
      setMensaje('Error de conexión. Intentá de nuevo.')
    }
  }

  const pct = total > 0 ? Math.round((escaneados / total) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-5">

        {/* Resultado */}
        {estado === 'scanning' && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center space-y-4">
            <Loader2 size={44} className="animate-spin text-brand-orange mx-auto" />
            <p className="font-bold text-brand-ink text-lg">Registrando escaneo...</p>
          </div>
        )}

        {estado === 'ok' && (
          <div className="bg-emerald-50 rounded-3xl border border-emerald-200 p-8 text-center space-y-4">
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
            {/* Progreso */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-bold text-emerald-700">{pct}%</span>
                <span className="text-emerald-600">{escaneados}/{total} puntos</span>
              </div>
              <div className="w-full bg-emerald-100 rounded-full h-2.5">
                <div className="h-2.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
            {escaneados < total ? (
              <p className="text-xs text-emerald-600 font-medium">
                Seguí al próximo punto de control
              </p>
            ) : (
              <p className="text-sm font-bold text-emerald-700">¡Ronda completada! Volviendo...</p>
            )}
          </div>
        )}

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

        {/* Punto info (siempre visible) */}
        {estado !== 'scanning' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Punto escaneado</p>
            <p className="font-bold text-brand-ink">{punto.nombre}</p>
            {punto.clientes && (
              <p className="text-xs text-gray-400 mt-0.5">{punto.clientes.nombre_empresa}</p>
            )}
          </div>
        )}

        {/* Volver a la ronda */}
        {(estado === 'ok' || estado === 'ya_escaneado') && rondaActiva && escaneados < total && (
          <button
            onClick={() => router.push(`/tecnico/ronda/${rondaActiva.id}`)}
            className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-600 font-semibold py-3.5 rounded-2xl bg-white"
          >
            Ver ronda completa <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
