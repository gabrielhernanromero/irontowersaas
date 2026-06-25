'use client'

import { useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { Lock, XCircle } from 'lucide-react'
import dynamic from 'next/dynamic'
const FirmaCanvas = dynamic(() => import('@/components/signature/FirmaCanvas'), {
  ssr: false,
  loading: () => <div className="h-[170px] bg-gray-100 rounded-lg animate-pulse" />,
})
import { CerrarTurnoSchema, type CerrarTurnoInput } from '@/lib/validations/libroTurno'

function nowTime() { return new Date().toTimeString().slice(0, 5) }

interface Props {
  turnoId: string
}

export default function CerrarGuardiaForm({ turnoId }: Props) {
  const router = useRouter()
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
        <FirmaCanvas onChange={handleFirma} label="Tu firma (personal saliente)" />
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
  )
}
