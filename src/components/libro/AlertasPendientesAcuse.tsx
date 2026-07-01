'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BellRing, CheckCircle2, AlertTriangle, Loader2, ChevronDown, X } from 'lucide-react'
import type { LibroNovedad } from '@/types/database'

interface Props {
  alertas: LibroNovedad[]
}

type Severidad = 'bajo' | 'medio' | 'alto'

function formatHora(h: string | null) { return h ? h.slice(0, 5) : '—' }

export default function AlertasPendientesAcuse({ alertas }: Props) {
  const router = useRouter()

  const [procesando, setProcesando]       = useState<string | null>(null)
  const [errores, setErrores]             = useState<Record<string, string>>({})
  // Estado del mini-form de conversión
  const [convirtiendo, setConvirtiendo]   = useState<string | null>(null)
  const [titulo, setTitulo]               = useState('')
  const [severidad, setSeveridad]         = useState<Severidad>('medio')

  if (alertas.length === 0) return null

  function abrirConversion(alerta: LibroNovedad) {
    setConvirtiendo(alerta.id)
    setTitulo(alerta.descripcion.slice(0, 80))
    setSeveridad('medio')
    setErrores(prev => ({ ...prev, [alerta.id]: '' }))
  }

  function cancelarConversion() {
    setConvirtiendo(null)
    setTitulo('')
  }

  const acusar = async (novedadId: string) => {
    setProcesando(novedadId)
    setErrores(prev => ({ ...prev, [novedadId]: '' }))
    try {
      const res  = await fetch(`/api/libro-novedad/${novedadId}/acusar`, { method: 'PATCH' })
      const data = await res.json()
      if (!res.ok) { setErrores(prev => ({ ...prev, [novedadId]: data.error ?? 'Error' })); return }
      router.refresh()
    } catch {
      setErrores(prev => ({ ...prev, [novedadId]: 'Error de conexión' }))
    } finally {
      setProcesando(null)
    }
  }

  const convertir = async (novedadId: string) => {
    if (!titulo.trim()) {
      setErrores(prev => ({ ...prev, [novedadId]: 'El título es obligatorio' }))
      return
    }
    setProcesando(novedadId)
    setErrores(prev => ({ ...prev, [novedadId]: '' }))
    try {
      const res  = await fetch(`/api/libro-novedad/${novedadId}/convertir-incidencia`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ titulo: titulo.trim(), severidad }),
      })
      const data = await res.json()
      if (!res.ok) { setErrores(prev => ({ ...prev, [novedadId]: data.error ?? 'Error' })); return }
      setConvirtiendo(null)
      router.refresh()
    } catch {
      setErrores(prev => ({ ...prev, [novedadId]: 'Error de conexión' }))
    } finally {
      setProcesando(null)
    }
  }

  return (
    <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <BellRing size={16} className="text-red-600 animate-pulse" />
        <h2 className="text-sm font-bold text-red-800">
          {alertas.length === 1
            ? '1 alerta del apoyo sin acusar'
            : `${alertas.length} alertas del apoyo sin acusar`}
        </h2>
      </div>

      <div className="space-y-3">
        {alertas.map((a) => {
          const autor      = (a.users as { nombre?: string; apellido?: string } | null)
          const autorNombre = autor?.nombre ? `${autor.nombre} ${autor.apellido ?? ''}`.trim() : 'Apoyo'
          const estaConvirtiendo = convirtiendo === a.id

          return (
            <div key={a.id} className="bg-white rounded-xl border border-red-200 p-3">
              {/* Cabecera de la alerta */}
              <p className="text-xs text-gray-400 mb-0.5">
                {autorNombre} · {formatHora(a.hora)}
              </p>
              <p className="text-sm text-brand-ink leading-snug mb-3">{a.descripcion}</p>

              {errores[a.id] && (
                <p className="text-xs text-red-600 mb-2">{errores[a.id]}</p>
              )}

              {/* Mini-form de conversión */}
              {estaConvirtiendo ? (
                <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Nueva incidencia</p>
                    <button
                      type="button"
                      onClick={cancelarConversion}
                      className="p-1 text-gray-400 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Título <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={titulo}
                      onChange={e => setTitulo(e.target.value)}
                      placeholder="Ej: Corte de luz en sector norte"
                      className="w-full border border-gray-300 rounded-lg p-2.5 text-sm min-h-[44px]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Severidad</label>
                    <div className="relative">
                      <select
                        value={severidad}
                        onChange={e => setSeveridad(e.target.value as Severidad)}
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm min-h-[44px] appearance-none bg-white"
                      >
                        <option value="bajo">Baja — Informativa</option>
                        <option value="medio">Media — Requiere seguimiento</option>
                        <option value="alto">Alta — Acción inmediata</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  <button
                    onClick={() => convertir(a.id)}
                    disabled={!!procesando}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-red-500 text-white font-semibold text-sm rounded-lg active:bg-red-600 disabled:opacity-50 transition-colors min-h-[48px]"
                  >
                    {procesando === a.id
                      ? <Loader2 size={14} className="animate-spin" />
                      : <AlertTriangle size={14} />
                    }
                    Confirmar incidencia
                  </button>
                </div>
              ) : (
                /* Botones de acción */
                <div className="flex gap-2">
                  <button
                    onClick={() => acusar(a.id)}
                    disabled={!!procesando}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-green-50 text-green-700 font-semibold text-xs rounded-lg active:bg-green-100 disabled:opacity-50 transition-colors min-h-[44px]"
                  >
                    {procesando === a.id
                      ? <Loader2 size={13} className="animate-spin" />
                      : <CheckCircle2 size={13} />
                    }
                    Acusar recibo
                  </button>
                  <button
                    onClick={() => abrirConversion(a)}
                    disabled={!!procesando}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red-50 text-red-600 font-semibold text-xs rounded-lg active:bg-red-100 disabled:opacity-50 transition-colors min-h-[44px]"
                  >
                    <AlertTriangle size={13} />
                    Hacer incidencia
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
