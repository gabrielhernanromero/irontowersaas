'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Wrench, AlertOctagon, Camera, X, CheckCircle2, Send,
} from 'lucide-react'

type TipoNovedad = 'dañado' | 'extraviado'

interface Props {
  elementoId: string
  elementoNombre: string
  codigoPatrimonial: string
  turnoId: string
  folioNumero: number
  defaultTipo?: TipoNovedad
}

export default function ReportarNovedadForm({
  elementoId, elementoNombre, codigoPatrimonial, turnoId, folioNumero, defaultTipo,
}: Props) {
  const router = useRouter()
  const [tipo, setTipo] = useState<TipoNovedad>(defaultTipo ?? 'dañado')
  const [descripcion, setDescripcion] = useState('')
  const [foto, setFoto] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const valido = descripcion.trim().length >= 10
  const esExtraviado = tipo === 'extraviado'

  function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setFoto(file)
    if (file) {
      const url = URL.createObjectURL(file)
      setFotoPreview(url)
    } else {
      setFotoPreview(null)
    }
  }

  function quitarFoto() {
    setFoto(null)
    setFotoPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valido) return
    setSubmitting(true)
    setError(null)

    try {
      // 1. Subir foto si existe
      let fotoUrl: string | undefined
      if (foto) {
        const fd = new FormData()
        fd.append('file', foto)
        const upRes = await fetch('/api/upload/foto', { method: 'POST', body: fd })
        if (upRes.ok) {
          const { path } = await upRes.json()
          fotoUrl = path
        }
        // Si falla la foto continuamos igual — no bloqueamos el reporte
      }

      // 2. Enviar la novedad
      const res = await fetch('/api/inventario/reportar-falla', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          turnoId,
          elementoId,
          tipo,
          descripcionFalla: descripcion,
          fotoUrl,
        }),
      })

      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al registrar la novedad'); return }

      router.push('/tecnico/elementos?novedad=ok')
      router.refresh()
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 pb-32">

      {/* Info del turno */}
      <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
        <CheckCircle2 size={13} className="text-green-500" />
        Guardia activa — Folio #{folioNumero}
      </div>

      {/* Activo afectado */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p className="text-xs text-gray-400 mb-1">Activo afectado</p>
        <p className="font-bold text-brand-ink text-base">{elementoNombre}</p>
        <p className="text-xs text-gray-400">{codigoPatrimonial}</p>
      </div>

      {/* Selector de tipo */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-brand-ink">¿Qué ocurrió? <span className="text-red-500">*</span></p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setTipo('dañado')}
            className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 min-h-[80px] transition-colors ${
              tipo === 'dañado'
                ? 'border-amber-400 bg-amber-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <Wrench size={22} className={tipo === 'dañado' ? 'text-amber-500' : 'text-gray-400'} />
            <span className={`text-sm font-semibold ${tipo === 'dañado' ? 'text-amber-700' : 'text-gray-500'}`}>
              Equipo Dañado
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTipo('extraviado')}
            className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 min-h-[80px] transition-colors ${
              tipo === 'extraviado'
                ? 'border-red-400 bg-red-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <AlertOctagon size={22} className={tipo === 'extraviado' ? 'text-red-500' : 'text-gray-400'} />
            <span className={`text-sm font-semibold ${tipo === 'extraviado' ? 'text-red-700' : 'text-gray-500'}`}>
              Equipo Extraviado
            </span>
          </button>
        </div>
      </div>

      {/* Banner contextual */}
      <div className={`rounded-xl border p-3 ${
        esExtraviado
          ? 'bg-red-50 border-red-300'
          : 'bg-amber-50 border-amber-200'
      }`}>
        <p className={`text-xs ${esExtraviado ? 'text-red-800' : 'text-amber-800'}`}>
          {esExtraviado
            ? '🚨 Un equipo extraviado genera una alerta crítica para el supervisor y queda registrado como responsabilidad de tu turno.'
            : 'Al enviar este formulario quedará constancia de que el daño ocurrió durante tu guardia activa. El reporte voluntario acredita tu buena fe.'
          }
        </p>
      </div>

      {/* Textarea descriptivo */}
      <div>
        <label htmlFor="descripcion-novedad" className="block text-sm font-semibold text-brand-ink mb-1.5">
          {esExtraviado ? 'Detalle del extravío' : 'Descripción del daño'}
          {' '}<span className="text-red-500">*</span>
        </label>
        <textarea
          id="descripcion-novedad"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder={
            esExtraviado
              ? 'Describí cuándo fue la última vez que viste el equipo, dónde podría estar, etc...'
              : 'Describí qué pasó, cuándo lo notaste y en qué estado quedó el equipo...'
          }
          rows={4}
          className="w-full border border-gray-300 rounded-xl p-3 text-base resize-none focus:outline-none focus:border-brand-orange"
        />
        <p className={`text-xs mt-1 ${valido ? 'text-green-600' : 'text-gray-400'}`}>
          {descripcion.trim().length} / 10 caracteres mínimos
        </p>
      </div>

      {/* Foto opcional */}
      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFoto}
        />

        {fotoPreview ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fotoPreview}
              alt="Vista previa"
              className="w-full rounded-xl object-cover max-h-56 border border-gray-200"
            />
            <button
              type="button"
              onClick={quitarFoto}
              className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1.5"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-4 text-gray-500 text-sm font-medium active:bg-gray-50 min-h-[52px]"
          >
            <Camera size={18} />
            Adjuntar foto (Opcional)
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      {/* Botón submit — fixed sobre la nav */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 md:left-56 z-50 bg-white border-t border-gray-200 p-3">
        <div className="max-w-2xl mx-auto">
          <button
            type="submit"
            disabled={!valido || submitting}
            className={`w-full flex items-center justify-center gap-2 font-bold py-4 rounded-xl text-base min-h-[56px] text-white disabled:opacity-40 transition-colors ${
              esExtraviado ? 'bg-red-600' : 'bg-amber-500'
            }`}
          >
            <Send size={18} />
            {submitting ? 'Registrando...' : 'Registrar Novedad'}
          </button>
        </div>
      </div>
    </form>
  )
}
