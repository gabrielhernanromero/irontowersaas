'use client'

import { useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Lock, XCircle } from 'lucide-react'
import Link from 'next/link'
import FirmaCanvas from '@/components/signature/FirmaCanvas'
import { CerrarTurnoSchema, type CerrarTurnoInput } from '@/lib/validations/libroTurno'

function nowTime() { return new Date().toTimeString().slice(0, 5) }

interface Props {
  searchParams: { turno_id?: string }
}

export default function CerrarGuardiaPage({ searchParams }: Props) {
  const router = useRouter()
  const turnoId = searchParams.turno_id ?? ''

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [firmaDataUrl, setFirmaDataUrl] = useState<string | null>(null)

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<CerrarTurnoInput>({
    resolver: zodResolver(CerrarTurnoSchema),
    defaultValues: {
      turno_id: turnoId,
      horario_fin: nowTime(),
      firma_cierre_dataurl: '',
    },
  })

  const handleFirma = useCallback((dataUrl: string | null) => {
    setFirmaDataUrl(dataUrl)
    setValue('firma_cierre_dataurl', dataUrl ?? '', { shouldValidate: true })
  }, [setValue])

  async function onSubmit(data: CerrarTurnoInput) {
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/libro-turno/cerrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al cerrar el turno'); return }
      router.push('/tecnico/libro-guardia')
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
        <h1 className="text-xl font-condensed font-bold text-brand-ink">Cerrar guardia</h1>
      </div>

      {/* Aviso */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
        <Lock size={18} className="text-amber-600 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">
          Una vez cerrado el turno <strong>no podrás agregar más novedades</strong>.
          El técnico entrante deberá firmar el relevo.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <div>
          <label htmlFor="horario_fin" className="block text-sm font-medium mb-1">
            Horario de fin
          </label>
          <input
            id="horario_fin"
            type="time"
            {...register('horario_fin')}
            className="w-full border border-gray-300 rounded p-3 text-base min-h-[44px]"
          />
          {errors.horario_fin && <p className="text-red-600 text-sm mt-1">{errors.horario_fin.message}</p>}
        </div>

        <div>
          <FirmaCanvas
            onChange={handleFirma}
            label="Tu firma (personal saliente)"
          />
          {errors.firma_cierre_dataurl && !firmaDataUrl && (
            <p className="text-red-600 text-sm mt-1">{errors.firma_cierre_dataurl.message}</p>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center">
          La novedad de cierre se genera automáticamente con tu nombre y DNI.
        </p>

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
              className="w-full bg-brand-ink text-white font-bold py-4 rounded-lg text-base min-h-[56px] disabled:opacity-60"
            >
              {submitting ? 'Cerrando...' : 'Cerrar guardia'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
