'use client'

import { useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { CheckCircle2, AlertTriangle, XCircle, Camera } from 'lucide-react'
import { LibroGuardiaSchema, type LibroGuardiaInput } from '@/lib/validations/libroGuardia'

function nowTime() {
  return new Date().toTimeString().slice(0, 5)
}

function todayDate() {
  return new Date().toISOString().split('T')[0]
}

function currentTurno(): 'diurno' | 'nocturno' {
  return new Date().getHours() < 18 ? 'diurno' : 'nocturno'
}

export default function LibroGuardiaForm() {
  const router = useRouter()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [uploadingFoto, setUploadingFoto] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LibroGuardiaInput>({
    resolver: zodResolver(LibroGuardiaSchema),
    defaultValues: {
      fecha: todayDate(),
      turno: currentTurno(),
      horario_inicio: nowTime(),
      horario_fin: '',
      sin_novedades: false,
      hora: nowTime(),
      descripcion: '',
      riesgo_detectado: '',
      medidas_adoptadas: '',
      observaciones_generales: null,
      planilla_id: null,
    },
  })

  const sinNovedades = watch('sin_novedades')

  const handleFoto = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setFotoFile(file)
    if (file) {
      setFotoPreview(URL.createObjectURL(file))
    } else {
      setFotoPreview(null)
    }
  }, [])

  async function onSubmit(data: LibroGuardiaInput) {
    setSubmitError(null)
    setSubmitting(true)

    try {
      let foto_url: string | null = null

      if (fotoFile && !data.sin_novedades) {
        setUploadingFoto(true)
        const fd = new FormData()
        fd.append('file', fotoFile)
        const uploadRes = await fetch('/api/upload/foto', { method: 'POST', body: fd })
        setUploadingFoto(false)
        if (!uploadRes.ok) throw new Error('Error al subir la foto')
        const { path } = await uploadRes.json()
        foto_url = path
      }

      const res = await fetch('/api/libro-guardia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, foto_url }),
      })

      const json = await res.json()
      if (!res.ok) {
        setSubmitError(json.error ?? 'Error al registrar el libro de guardia')
        return
      }

      router.push('/tecnico/libro-guardia?nueva=1')
    } catch {
      setSubmitError('Error de conexión. Intentá de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 pb-28">

      {/* ── Encabezado del turno ── */}
      <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Datos del turno
        </h2>

        <div>
          <label htmlFor="fecha" className="block text-sm font-medium mb-1">Fecha</label>
          <input
            id="fecha"
            type="date"
            {...register('fecha')}
            className="w-full border border-gray-300 rounded p-3 text-base min-h-[44px]"
          />
          {errors.fecha && <p className="text-red-600 text-sm mt-1">{errors.fecha.message}</p>}
        </div>

        <div>
          <label htmlFor="turno" className="block text-sm font-medium mb-1">Turno</label>
          <select
            id="turno"
            {...register('turno')}
            className="w-full border border-gray-300 rounded p-3 text-base min-h-[44px]"
          >
            <option value="diurno">Diurno</option>
            <option value="nocturno">Nocturno</option>
          </select>
          {errors.turno && <p className="text-red-600 text-sm mt-1">{errors.turno.message}</p>}
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label htmlFor="horario_inicio" className="block text-sm font-medium mb-1">
              Horario inicio
            </label>
            <input
              id="horario_inicio"
              type="time"
              {...register('horario_inicio')}
              className="w-full border border-gray-300 rounded p-3 text-base min-h-[44px]"
            />
            {errors.horario_inicio && (
              <p className="text-red-600 text-sm mt-1">{errors.horario_inicio.message}</p>
            )}
          </div>
          <div className="flex-1">
            <label htmlFor="horario_fin" className="block text-sm font-medium mb-1">
              Horario fin
            </label>
            <input
              id="horario_fin"
              type="time"
              {...register('horario_fin')}
              className="w-full border border-gray-300 rounded p-3 text-base min-h-[44px]"
            />
            {errors.horario_fin && (
              <p className="text-red-600 text-sm mt-1">{errors.horario_fin.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Toggle sin novedades ── */}
      <div className="rounded-xl border-2 overflow-hidden">
        <label
          htmlFor="sin_novedades"
          className={`flex items-center gap-4 p-4 cursor-pointer transition-colors ${
            sinNovedades ? 'bg-green-50 border-green-400' : 'bg-amber-50 border-amber-400'
          }`}
        >
          <input
            id="sin_novedades"
            type="checkbox"
            {...register('sin_novedades')}
            className="sr-only"
          />
          <div
            className={`w-14 h-8 rounded-full flex items-center px-1 transition-colors ${
              sinNovedades ? 'bg-green-500' : 'bg-amber-400'
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full bg-white shadow transition-transform ${
                sinNovedades ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </div>
          <div>
            <p className="font-semibold text-brand-ink">
              {sinNovedades ? 'Turno sin novedades' : '¿Hubo novedades en el turno?'}
            </p>
            <p className="text-xs text-gray-500">
              {sinNovedades
                ? 'El turno transcurrió sin novedades relevantes'
                : 'Activá si hubo algo que reportar'}
            </p>
          </div>
          {sinNovedades && <CheckCircle2 className="ml-auto text-green-600" size={24} />}
          {!sinNovedades && <AlertTriangle className="ml-auto text-amber-500" size={24} />}
        </label>
      </div>

      {/* ── Sección de novedades (visible solo si hay novedades) ── */}
      {!sinNovedades && (
        <div className="flex flex-col gap-4 border border-amber-200 rounded-xl p-4 bg-amber-50/40">
          <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wide">
            Novedad del turno
          </h2>

          <div>
            <label htmlFor="hora" className="block text-sm font-medium mb-1">
              Hora de la novedad
            </label>
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
              Descripción
            </label>
            <textarea
              id="descripcion"
              {...register('descripcion')}
              rows={3}
              placeholder="Describí brevemente qué pasó"
              className="w-full border border-gray-300 rounded p-3 text-base"
            />
            {errors.descripcion && (
              <p className="text-red-600 text-sm mt-1">{errors.descripcion.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="riesgo_detectado" className="block text-sm font-medium mb-1">
              Riesgo detectado
            </label>
            <textarea
              id="riesgo_detectado"
              {...register('riesgo_detectado')}
              rows={3}
              placeholder="¿Qué riesgo implicó esta novedad?"
              className="w-full border border-gray-300 rounded p-3 text-base"
            />
            {errors.riesgo_detectado && (
              <p className="text-red-600 text-sm mt-1">{errors.riesgo_detectado.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="medidas_adoptadas" className="block text-sm font-medium mb-1">
              Medidas adoptadas
            </label>
            <textarea
              id="medidas_adoptadas"
              {...register('medidas_adoptadas')}
              rows={3}
              placeholder="¿Qué acciones correctivas se tomaron?"
              className="w-full border border-gray-300 rounded p-3 text-base"
            />
            {errors.medidas_adoptadas && (
              <p className="text-red-600 text-sm mt-1">{errors.medidas_adoptadas.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="observaciones_generales" className="block text-sm font-medium mb-1">
              Observaciones generales{' '}
              <span className="text-gray-400 text-xs">(opcional)</span>
            </label>
            <textarea
              id="observaciones_generales"
              {...register('observaciones_generales')}
              rows={2}
              className="w-full border border-gray-300 rounded p-3 text-base"
            />
          </div>

          {/* Foto */}
          <div>
            <p className="text-sm font-medium mb-2">
              Foto <span className="text-gray-400 text-xs">(opcional)</span>
            </p>
            {fotoPreview ? (
              <div className="relative w-full rounded-xl overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fotoPreview}
                  alt="Vista previa de la foto"
                  className="w-full h-48 object-cover rounded-xl"
                />
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
                className="flex flex-col items-center justify-center gap-2 w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer text-gray-400 hover:border-brand-orange transition-colors"
              >
                <Camera size={28} />
                <span className="text-sm">Tocar para sacar foto</span>
                <input
                  id="foto"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={handleFoto}
                />
              </label>
            )}
          </div>
        </div>
      )}

      {submitError && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-3 text-red-700 text-sm flex gap-2 items-start">
          <XCircle size={16} className="shrink-0 mt-0.5" />
          {submitError}
        </div>
      )}

      {/* Botón sticky */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 md:left-56 z-50 bg-white border-t border-gray-200 p-3">
        <div className="max-w-2xl mx-auto">
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-brand-orange text-white font-bold py-4 rounded-lg text-base min-h-[56px] disabled:opacity-60"
          >
            {submitting
              ? uploadingFoto
                ? 'Subiendo foto...'
                : 'Guardando...'
              : sinNovedades
              ? 'Registrar turno sin novedades'
              : 'Registrar novedad'}
          </button>
        </div>
      </div>
    </form>
  )
}
