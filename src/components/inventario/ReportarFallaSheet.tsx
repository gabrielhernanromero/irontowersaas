'use client'

import { useState } from 'react'
import { X, AlertTriangle, Send } from 'lucide-react'

interface Props {
  elementoId: string
  elementoNombre: string
  codigoPatrimonial: string
  turnoId: string
  onClose: () => void
  onSuccess: () => void
}

export default function ReportarFallaSheet({
  elementoId, elementoNombre, codigoPatrimonial, turnoId, onClose, onSuccess,
}: Props) {
  const [descripcion, setDescripcion] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const valido = descripcion.trim().length >= 10

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valido) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/inventario/reportar-falla', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turnoId, elementoId, descripcionFalla: descripcion }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al reportar'); return }
      onSuccess()
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-[70] bg-white rounded-t-2xl shadow-xl">
        <div className="max-w-[430px] mx-auto">
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>
          <div className="px-4 pb-8 pt-2">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-500" />
                <p className="font-bold text-brand-ink text-base">Reportar falla de material</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            {/* Elemento */}
            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <p className="text-xs text-gray-500">Activo afectado</p>
              <p className="font-semibold text-brand-ink">{elementoNombre}</p>
              <p className="text-xs text-gray-400">{codigoPatrimonial}</p>
            </div>

            {/* Aviso legal */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
              <p className="text-xs text-amber-800">
                Al enviar este formulario quedará constancia de que el daño ocurrió durante tu guardia activa.
                El reporte voluntario acredita tu buena fe.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label htmlFor="descripcion-falla" className="block text-sm font-medium text-brand-ink mb-1">
                  Descripción del daño <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="descripcion-falla"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Describí qué pasó, cuándo lo notaste y en qué estado quedó el equipo..."
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg p-3 text-base resize-none"
                />
                <p className={`text-xs mt-1 ${valido ? 'text-green-600' : 'text-gray-400'}`}>
                  {descripcion.trim().length}/10 caracteres mínimos
                </p>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={!valido || submitting}
                className="flex items-center justify-center gap-2 w-full bg-amber-500 text-white font-bold py-4 rounded-xl text-base min-h-[56px] disabled:opacity-40"
              >
                <Send size={18} />
                {submitting ? 'Enviando...' : 'Reportar falla'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
