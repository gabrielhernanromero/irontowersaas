'use client'

import { useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Camera, XCircle, AlertTriangle, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { NuevaNovedadSchema, type NuevaNovedadInput } from '@/lib/validations/libroTurno'

function nowTime() { return new Date().toTimeString().slice(0, 5) }

interface Props {
  searchParams: { turno_id?: string }
}

export default function NuevaNovedadPage({ searchParams }: Props) {
  const router = useRouter()
  const turnoId = searchParams.turno_id ?? ''

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const [esIncidencia, setEsIncidencia] = useState(false)

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<NuevaNovedadInput>({
    resolver: zodResolver(NuevaNovedadSchema),
    defaultValues: {
      turno_id: turnoId,
      hora: nowTime(),
      descripcion: '',
      riesgo_detectado: '',
      medidas_adoptadas: '',
      observaciones_generales: '',
      es_incidencia: false,
      incidencia_titulo: '',
      incidencia_severidad: 'medio',
    },
  })

  const handleFoto = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setFotoFile(file)
    setFotoPreview(file ? URL.createObjectURL(file) : null)
  }, [])

  function toggleIncidencia(checked: boolean) {
    setEsIncidencia(checked)
    setValue('es_incidencia', checked)
  }

  async function onSubmit(data: NuevaNovedadInput) {
    setError(null)
    setSubmitting(true)
    try {
      let foto_url: string | undefined
      if (fotoFile) {
        setUploadingFoto(true)
        const fd = new FormData()
        fd.append('file', fotoFile)
        const uploadRes = await fetch('/api/upload/foto', { method: 'POST', body: fd })
        setUploadingFoto(false)
        if (!uploadRes.ok) throw new Error('Error al subir foto')
        const { path } = await uploadRes.json()
        foto_url = path
      }

      const res = await fetch('/api/libro-novedad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, foto_url }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al registrar la novedad'); return }
      router.push('/tecnico/libro-guardia?ok=1')
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="pb-28">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/tecnico/libro-guardia" className="p-2 -ml-2 text-gray-500 min-h-[44px] flex items-center">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-condensed font-bold text-brand-ink">Nueva novedad</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div>
          <label htmlFor="hora" className="block text-sm font-medium mb-1">Hora</label>
          <input
            id="hora"
            type="time"
            {...register('hora')}
            className="w-full border border-gray-300 rounded p-3 text-base min-h-[44px]"
          />
          {errors.hora && <p className="text-red-600 text-sm mt-1">{errors.hora.message}</p>}
        </div>

        <div>
          <label htmlFor="descripcion" className="block text-sm font-medium mb-1">
            Descripción <span className="text-red-500">*</span>
          </label>
          <textarea
            id="descripcion"
            {...register('descripcion')}
            rows={3}
            placeholder="¿Qué ocurrió?"
            className="w-full border border-gray-300 rounded p-3 text-base"
          />
          {errors.descripcion && <p className="text-red-600 text-sm mt-1">{errors.descripcion.message}</p>}
        </div>

        <div>
          <label htmlFor="riesgo_detectado" className="block text-sm font-medium mb-1">
            Riesgo detectado <span className="text-gray-400 text-xs">(opcional)</span>
          </label>
          <textarea
            id="riesgo_detectado"
            {...register('riesgo_detectado')}
            rows={2}
            placeholder="¿Qué riesgo implicó?"
            className="w-full border border-gray-300 rounded p-3 text-base"
          />
        </div>

        <div>
          <label htmlFor="medidas_adoptadas" className="block text-sm font-medium mb-1">
            Medidas adoptadas <span className="text-gray-400 text-xs">(opcional)</span>
          </label>
          <textarea
            id="medidas_adoptadas"
            {...register('medidas_adoptadas')}
            rows={2}
            placeholder="¿Qué acciones se tomaron?"
            className="w-full border border-gray-300 rounded p-3 text-base"
          />
        </div>

        <div>
          <label htmlFor="observaciones" className="block text-sm font-medium mb-1">
            Observaciones generales <span className="text-gray-400 text-xs">(opcional)</span>
          </label>
          <textarea
            id="observaciones"
            {...register('observaciones_generales')}
            rows={2}
            className="w-full border border-gray-300 rounded p-3 text-base"
          />
        </div>

        {/* Foto */}
        <div>
          <p className="text-sm font-medium mb-2">Foto <span className="text-gray-400 text-xs">(opcional)</span></p>
          {fotoPreview ? (
            <div className="relative w-full rounded-xl overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fotoPreview} alt="Vista previa" className="w-full h-48 object-cover rounded-xl" />
              <button
                type="button"
                onClick={() => { setFotoFile(null); setFotoPreview(null) }}
                className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1"
              >
                <XCircle size={20} />
              </button>
            </div>
          ) : (
            <label
              htmlFor="foto"
              className="flex flex-col items-center justify-center gap-2 w-full h-28 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer text-gray-400"
            >
              <Camera size={24} />
              <span className="text-sm">Tocar para sacar foto</span>
              <input id="foto" type="file" accept="image/*" capture="environment" className="sr-only" onChange={handleFoto} />
            </label>
          )}
        </div>

        {/* Toggle incidencia persistente */}
        <div className={`rounded-xl border-2 transition-colors ${esIncidencia ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'}`}>
          <button
            type="button"
            onClick={() => toggleIncidencia(!esIncidencia)}
            className="w-full flex items-center justify-between p-4 min-h-[56px]"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle size={20} className={esIncidencia ? 'text-red-500' : 'text-gray-400'} />
              <div className="text-left">
                <p className={`text-sm font-semibold ${esIncidencia ? 'text-red-700' : 'text-brand-ink'}`}>
                  Incidencia persistente
                </p>
                <p className="text-xs text-gray-500">Se arrastra entre turnos hasta resolverse</p>
              </div>
            </div>
            <div className={`w-12 h-6 rounded-full transition-colors relative ${esIncidencia ? 'bg-red-500' : 'bg-gray-300'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${esIncidencia ? 'translate-x-7' : 'translate-x-1'}`} />
            </div>
          </button>

          {esIncidencia && (
            <div className="px-4 pb-4 flex flex-col gap-3 border-t border-red-200">
              <div className="pt-3">
                <label htmlFor="incidencia_titulo" className="block text-sm font-medium mb-1 text-red-700">
                  Título de la incidencia <span className="text-red-500">*</span>
                </label>
                <input
                  id="incidencia_titulo"
                  type="text"
                  {...register('incidencia_titulo')}
                  placeholder="Ej: Falla en portón norte"
                  className="w-full border border-red-300 rounded-lg p-3 text-base min-h-[44px] bg-white"
                />
                {errors.incidencia_titulo && (
                  <p className="text-red-600 text-sm mt-1">{errors.incidencia_titulo.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="incidencia_severidad" className="block text-sm font-medium mb-1 text-red-700">
                  Severidad
                </label>
                <div className="relative">
                  <select
                    id="incidencia_severidad"
                    {...register('incidencia_severidad')}
                    className="w-full border border-red-300 rounded-lg p-3 text-base min-h-[44px] bg-white appearance-none"
                  >
                    <option value="bajo">Baja — Informativa</option>
                    <option value="medio">Media — Requiere seguimiento</option>
                    <option value="alto">Alta — Acción inmediata</option>
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-3 text-red-700 text-sm flex gap-2">
            <XCircle size={16} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <div className="fixed bottom-16 left-0 right-0 z-50 bg-white border-t border-gray-200 p-3">
          <div className="max-w-[430px] mx-auto">
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-brand-orange text-white font-bold py-4 rounded-lg text-base min-h-[56px] disabled:opacity-60"
            >
              {submitting ? (uploadingFoto ? 'Subiendo foto...' : 'Guardando...') : 'Registrar novedad'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
