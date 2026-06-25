'use client'

import { useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { Lock, XCircle, AlertTriangle } from 'lucide-react'
import dynamic from 'next/dynamic'
const FirmaCanvas = dynamic(() => import('@/components/signature/FirmaCanvas'), {
  ssr: false,
  loading: () => <div className="h-[170px] bg-gray-100 rounded-lg animate-pulse" />,
})
import { CerrarTurnoSchema, type CerrarTurnoInput } from '@/lib/validations/libroTurno'

function nowTime() { return new Date().toTimeString().slice(0, 5) }

function minutosHastaFin(horaFin: string): number {
  const now = new Date()
  const [finH, finM] = horaFin.split(':').map(Number)
  const finMin = finH * 60 + finM
  const nowMin = now.getHours() * 60 + now.getMinutes()
  let diff = finMin - nowMin
  // Si diff es muy negativo, es turno nocturno que cruza medianoche
  if (diff < -120) diff += 1440
  return diff
}

function formatMinutos(mins: number): string {
  if (mins >= 60) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `${h}h ${m}min` : `${h}h`
  }
  return `${mins} min`
}

interface Props {
  turnoId: string
  horaFinEsquema?: string | null
}

export default function CerrarGuardiaForm({ turnoId, horaFinEsquema }: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [firmaDataUrl, setFirmaDataUrl] = useState<string | null>(null)

  // Estado del modal de cierre anticipado
  const [showModal, setShowModal] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [motivoError, setMotivoError] = useState('')
  const [minsAnticipado, setMinsAnticipado] = useState(0)
  const [formDataPendiente, setFormDataPendiente] = useState<CerrarTurnoInput | null>(null)

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

  async function submitData(data: CerrarTurnoInput, motivoCierre?: string) {
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/libro-turno/cerrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, motivo_cierre_anticipado: motivoCierre }),
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

  async function onSubmit(data: CerrarTurnoInput) {
    if (horaFinEsquema) {
      const mins = minutosHastaFin(horaFinEsquema)
      if (mins > 30) {
        setMinsAnticipado(mins)
        setFormDataPendiente(data)
        setShowModal(true)
        return
      }
    }
    await submitData(data)
  }

  function handleConfirmModal() {
    if (motivo.trim().length < 10) {
      setMotivoError('Ingresá al menos 10 caracteres para describir el motivo.')
      return
    }
    setShowModal(false)
    if (formDataPendiente) {
      submitData(formDataPendiente, motivo.trim())
    }
  }

  return (
    <>
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

      {/* Modal cierre anticipado */}
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50">
          <div className="bg-white rounded-t-2xl p-6 w-full max-w-[430px] pb-safe">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={20} className="text-amber-500 shrink-0" />
              <h3 className="font-bold text-brand-ink text-base">Cierre anticipado</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Estás cerrando el turno{' '}
              <strong>{formatMinutos(minsAnticipado)} antes</strong> del fin programado
              {horaFinEsquema ? ` (${horaFinEsquema})` : ''}.
              El supervisor será notificado. Indicá el motivo para que quede registrado.
            </p>

            <label className="block text-sm font-medium text-brand-ink mb-1">
              Motivo del cierre anticipado <span className="text-red-500">*</span>
            </label>
            <textarea
              value={motivo}
              onChange={(e) => { setMotivo(e.target.value); setMotivoError('') }}
              placeholder="Ej: Relevo temprano acordado con supervisión, emergencia familiar, etc."
              rows={4}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm mb-1 resize-none"
            />
            {motivoError && (
              <p className="text-red-600 text-xs mb-3">{motivoError}</p>
            )}

            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => { setShowModal(false); setMotivo(''); setMotivoError('') }}
                className="flex-1 py-3 border-2 border-gray-300 rounded-xl font-bold text-gray-700 min-h-[48px]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmModal}
                disabled={submitting}
                className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-bold min-h-[48px] disabled:opacity-60"
              >
                {submitting ? 'Cerrando...' : 'Confirmar cierre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
