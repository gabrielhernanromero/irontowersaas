'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Circle, MapPin, Loader2, Trophy, Flag } from 'lucide-react'

interface Scan  { id: string; punto_control_id: string }
interface Punto { id: string; nombre: string; ubicacion: string | null; orden: number }

interface Ronda {
  id: string
  numero_ronda: number
  hora_inicio: string
  hora_fin: string | null
  total_puntos: number
  puntos_escaneados: number
  completa: boolean
  clientes: { id: string; nombre_empresa: string } | null
  ronda_scans: Scan[]
}

interface Props {
  ronda:  Ronda
  puntos: Punto[]
}

export default function RondaActivaClient({ ronda, puntos }: Props) {
  const router = useRouter()
  const [scans,      setScans]      = useState<Scan[]>(ronda.ronda_scans)
  const [escaneados, setEscaneados] = useState(ronda.puntos_escaneados)
  const [completa,   setCompleta]   = useState(ronda.completa)
  const [completing, setCompleting] = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const escaneadosIds = new Set(scans.map(s => s.punto_control_id))
  const pct = ronda.total_puntos > 0 ? Math.round((escaneados / ronda.total_puntos) * 100) : 0

  async function completarRonda() {
    setCompleting(true)
    try {
      const res = await fetch(`/api/tecnico/ronda/${ronda.id}/completar`, { method: 'POST' })
      if (res.ok) {
        setCompleta(true)
        setTimeout(() => router.push('/tecnico/ronda'), 2000)
      }
    } finally { setCompleting(false) }
  }

  if (completa) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-5">
          <Trophy size={36} className="text-emerald-600" />
        </div>
        <p className="text-2xl font-black text-brand-ink">¡Ronda completada!</p>
        <p className="text-sm text-gray-500 mt-2">{escaneados}/{ronda.total_puntos} puntos verificados</p>
        <p className="text-xs text-gray-400 mt-4">Volviendo al inicio...</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black text-brand-ink">Ronda #{ronda.numero_ronda}</h1>
          <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2.5 py-1 rounded-full">
            En curso
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-0.5">{ronda.clientes?.nombre_empresa}</p>
      </div>

      {/* Progreso */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="font-bold text-brand-ink">{pct}% completado</span>
          <span className="text-gray-400">{escaneados} de {ronda.total_puntos} puntos</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div
            className="h-3 rounded-full bg-brand-orange transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Lista de puntos */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Puntos de control
        </p>

        {puntos.map((punto, i) => {
          const escaneado = escaneadosIds.has(punto.id)
          return (
            <div
              key={punto.id}
              className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                escaneado
                  ? 'bg-emerald-50 border-emerald-100'
                  : 'bg-white border-gray-100'
              }`}
            >
              {/* Icono */}
              {escaneado
                ? <CheckCircle size={24} className="text-emerald-500 shrink-0" />
                : <Circle      size={24} className="text-gray-200 shrink-0" />
              }

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-300">#{i + 1}</span>
                  <p className={`text-sm font-semibold ${escaneado ? 'text-emerald-700' : 'text-brand-ink'}`}>
                    {punto.nombre}
                  </p>
                </div>
                {punto.ubicacion && (
                  <p className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                    <MapPin size={10} /> {punto.ubicacion}
                  </p>
                )}
              </div>

              {escaneado && (
                <span className="text-xs font-semibold text-emerald-600 shrink-0">✓</span>
              )}
            </div>
          )
        })}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Instrucción o botón finalizar */}
      {escaneados < ronda.total_puntos ? (
        <div className="bg-brand-ink rounded-2xl p-4 text-white text-center">
          <p className="text-sm font-semibold">Escaneá el QR del próximo punto</p>
          <p className="text-xs text-white/60 mt-1">Abrí la cámara y apuntá al código QR del checkpoint</p>
        </div>
      ) : (
        <button
          onClick={completarRonda}
          disabled={completing}
          className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform disabled:opacity-60"
        >
          {completing
            ? <><Loader2 size={22} className="animate-spin" /> Finalizando...</>
            : <><Flag size={22} /> Finalizar ronda</>
          }
        </button>
      )}
    </div>
  )
}
