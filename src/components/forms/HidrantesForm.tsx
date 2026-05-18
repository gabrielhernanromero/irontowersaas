'use client'

import { useState, useCallback } from 'react'
import { useForm, FormProvider, FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { AlertTriangle, XCircle, ClipboardList } from 'lucide-react'
import type { Cliente } from '@/types/database'
import {
  PlanillaHidrantesSubmitSchema,
  type PlanillaHidrantesSubmit,
} from '@/lib/validations/planilla'
import HidranteRow from './HidranteRow'
import SignatureCanvas from '@/components/signature/SignatureCanvas'

function buildSummary(errors: FieldErrors<PlanillaHidrantesSubmit>): string[] {
  const msgs: string[] = []
  if (errors.cliente_id) msgs.push('Seleccioná un cliente')
  if (errors.firma_dataurl) msgs.push('Falta la firma del técnico')
  if (errors.firma_aclaracion) msgs.push('Falta la aclaración de la firma (nombre y apellido)')
  const itemErrors = errors.items
  if (Array.isArray(itemErrors)) {
    const count = itemErrors.filter(Boolean).length
    if (count > 0)
      msgs.push(`${count} ${count === 1 ? 'hidrante tiene' : 'hidrantes tienen'} observaciones incompletas`)
  }
  return msgs
}

const TOTAL_HIDRANTES = 48

function buildDefaultItems() {
  return Array.from({ length: TOTAL_HIDRANTES }, (_, i) => ({
    numero: `H-${String(i + 1).padStart(3, '0')}`,
    gabinete: true,
    manga: true,
    lanza: true,
    valvula: true,
    obs_gabinete: null,
    obs_manga: null,
    obs_lanza: null,
    obs_valvula: null,
    foto_url: null,
  }))
}

interface Props {
  clientes: Cliente[]
}

export default function HidrantesForm({ clientes }: Props) {
  const router = useRouter()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [alreadySent, setAlreadySent] = useState(false)
  const [validationMessages, setValidationMessages] = useState<string[]>([])

  const methods = useForm<PlanillaHidrantesSubmit>({
    resolver: zodResolver(PlanillaHidrantesSubmitSchema),
    defaultValues: {
      cliente_id: '',
      fecha: new Date().toISOString().split('T')[0],
      turno: new Date().getHours() < 18 ? 'diurno' : 'nocturno',
      items: buildDefaultItems(),
      firma_dataurl: '',
      firma_aclaracion: '',
    },
  })

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = methods

  const handleFirma = useCallback(
    (dataUrl: string | null) => {
      setValue('firma_dataurl', dataUrl ?? '', { shouldValidate: true })
    },
    [setValue]
  )

  const handleAclaracion = useCallback(
    (val: string) => {
      setValue('firma_aclaracion', val, { shouldValidate: true })
    },
    [setValue]
  )

  function onValidationError(errs: FieldErrors<PlanillaHidrantesSubmit>) {
    setValidationMessages(buildSummary(errs))
  }

  async function onSubmit(data: PlanillaHidrantesSubmit) {
    setSubmitError(null)
    setValidationMessages([])
    setSubmitting(true)
    try {
      const res = await fetch('/api/planillas/hidrantes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) {
        // Distinguir duplicado de "sin turno activo"
        if (res.status === 409 && json.error?.includes('Ya enviaste')) {
          setAlreadySent(true)
        } else {
          setSubmitError(json.error ?? 'Error al enviar la planilla')
        }
        return
      }
      router.push('/tecnico/home')
    } catch {
      setSubmitError('Error de conexión. Revisá tu internet e intentá de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <FormProvider {...methods}>
      {/* Modal: planilla ya enviada */}
      {alreadySent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
            <XCircle className="mx-auto mb-3 text-red-500" size={48} />
            <h2 className="text-lg font-bold text-brand-ink mb-2">Planilla ya enviada</h2>
            <p className="text-gray-600 text-sm mb-5">
              Ya registraste una planilla de hidrantes para este turno. No podés enviar dos planillas para el mismo turno.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => router.push('/tecnico/historial')}
                className="flex-1 flex items-center justify-center gap-2 border border-gray-300 text-brand-ink py-3 rounded-lg text-sm font-medium min-h-[44px]"
              >
                <ClipboardList size={16} />
                Ver historial
              </button>
              <button
                type="button"
                onClick={() => setAlreadySent(false)}
                className="flex-1 bg-brand-orange text-white py-3 rounded-lg text-sm font-bold min-h-[44px]"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit, onValidationError)} className="pb-44">
        {/* Encabezado */}
        <div className="flex flex-col gap-4 mb-6">
          <div>
            <label htmlFor="cliente_id" className="block text-sm font-medium mb-1">
              Cliente
            </label>
            <select
              id="cliente_id"
              {...register('cliente_id')}
              className="w-full border border-gray-300 rounded p-3 text-base min-h-[44px]"
            >
              <option value="">Seleccioná un cliente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre_empresa}
                </option>
              ))}
            </select>
            {errors.cliente_id && (
              <p className="text-red-600 text-sm mt-1">{errors.cliente_id.message}</p>
            )}
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="fecha" className="block text-sm font-medium mb-1">
                Fecha
              </label>
              <input
                id="fecha"
                type="date"
                {...register('fecha')}
                className="w-full border border-gray-300 rounded p-3 text-base min-h-[44px]"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="turno" className="block text-sm font-medium mb-1">
                Turno
              </label>
              <select
                id="turno"
                {...register('turno')}
                className="w-full border border-gray-300 rounded p-3 text-base min-h-[44px]"
              >
                <option value="diurno">Diurno</option>
                <option value="nocturno">Nocturno</option>
              </select>
            </div>
          </div>
        </div>

        {/* Lista de hidrantes */}
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-2 text-brand-ink">Hidrantes</h2>
          {Array.from({ length: TOTAL_HIDRANTES }, (_, i) => (
            <HidranteRow key={i} index={i} />
          ))}
        </div>

        {/* Firma */}
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-2 text-brand-ink">Firma del técnico</h2>
          <SignatureCanvas onChange={handleFirma} onAclaracionChange={handleAclaracion} />
          {errors.firma_dataurl && (
            <p className="text-red-600 text-sm mt-1">{errors.firma_dataurl.message}</p>
          )}
          {errors.firma_aclaracion && (
            <p className="text-red-600 text-sm mt-1">{errors.firma_aclaracion.message}</p>
          )}
        </div>

        {/* Botón sticky — encima de la nav bar */}
        <div className="fixed bottom-16 left-0 right-0 z-50 bg-white border-t border-gray-200 p-3">
          <div className="max-w-[430px] mx-auto space-y-2">
            {/* Resumen de validación */}
            {validationMessages.length > 0 && (
              <div className="bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 flex gap-2 items-start">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-800 text-xs font-semibold mb-1">Para enviar, completá:</p>
                  <ul className="text-amber-700 text-xs space-y-0.5 list-disc list-inside">
                    {validationMessages.map((m) => <li key={m}>{m}</li>)}
                  </ul>
                </div>
              </div>
            )}
            {/* Error de envío — siempre visible sobre el botón */}
            {submitError && (
              <div className="bg-red-50 border border-red-300 rounded-lg px-3 py-2 text-red-700 text-xs flex gap-2 items-start">
                <XCircle size={14} className="shrink-0 mt-0.5" />
                {submitError}
              </div>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-brand-orange text-white font-bold py-4 rounded-lg text-base min-h-[56px] disabled:opacity-60"
            >
              {submitting ? 'Enviando...' : 'Enviar Planilla'}
            </button>
          </div>
        </div>
      </form>
    </FormProvider>
  )
}
