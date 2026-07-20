'use client'

import { useState, useEffect } from 'react'
import { Loader2, AlertCircle, Plus, Trash2 } from 'lucide-react'
import FotoLightbox, { FotoThumb } from '@/components/ui/FotoLightbox'
import type { PlanoPlanta } from '@/types/database'

type PlanoPlantaRow = PlanoPlanta & { url: string | null }

export default function PlanoPlantaCard({ clienteId }: { clienteId: string }) {
  const [plano,      setPlano]      = useState<PlanoPlantaRow | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [uploading,  setUploading]  = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [lightbox,   setLightbox]   = useState(false)

  useEffect(() => {
    fetch(`/api/supervisor/planos?cliente_id=${clienteId}`)
      .then(r => r.json())
      .then(j => { setPlano(j.plano ?? null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [clienteId])

  async function handleFile(file: File) {
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('cliente_id', clienteId)
      const res = await fetch('/api/supervisor/planos', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al subir el plano'); return }
      setPlano(json.plano)
    } catch { setError('Error de conexión') }
    finally  { setUploading(false) }
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar el plano de planta?')) return
    const res = await fetch(`/api/supervisor/planos?cliente_id=${clienteId}`, { method: 'DELETE' })
    if (res.ok) setPlano(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-6">
      <Loader2 size={18} className="animate-spin text-gray-300" />
    </div>
  )

  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
        Plano / croquis de planta
      </p>
      <p className="text-xs text-gray-400 mb-3">
        El técnico lo puede ver desde la planilla para ubicar los ítems más rápido.
      </p>

      {error && (
        <div className="mb-3 flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg p-2">
          <AlertCircle size={13} />
          {error}
        </div>
      )}

      {plano ? (
        <div className="flex items-center gap-3">
          {plano.url && (
            <FotoThumb url={plano.url} onClick={() => setLightbox(true)} className="w-20 h-20 shrink-0" />
          )}
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-1.5 text-xs text-brand-orange font-semibold hover:underline cursor-pointer min-h-[44px]">
              {uploading ? <Loader2 size={13} className="animate-spin" /> : null}
              Reemplazar plano
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
            </label>
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 text-xs text-red-500 font-semibold hover:underline min-h-[44px] text-left"
            >
              <Trash2 size={12} /> Eliminar plano
            </button>
          </div>
          {lightbox && plano.url && (
            <FotoLightbox url={plano.url} alt="Plano de planta" onClose={() => setLightbox(false)} />
          )}
        </div>
      ) : (
        <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl p-4 text-sm text-gray-500 font-medium cursor-pointer min-h-[52px] hover:border-brand-orange hover:text-brand-orange transition-colors">
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          {uploading ? 'Subiendo...' : 'Cargar plano de planta'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
        </label>
      )}
    </div>
  )
}
