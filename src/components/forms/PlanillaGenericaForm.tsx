'use client'

import { useState, useCallback, useEffect } from 'react'
import { useForm, FormProvider, FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { AlertTriangle, XCircle, ClipboardList, Building2 } from 'lucide-react'
import {
  buildPlanillaGenericaSchema,
  type PlanillaGenericaSubmit,
} from '@/lib/validations/planillaGenerica'
import PlanillaGenericaRow from './PlanillaGenericaRow'
import SignatureCanvas from '@/components/signature/SignatureCanvas'
import { VerFotoBtn } from '@/components/ui/FotoLightbox'

function buildSummary(errors: FieldErrors<PlanillaGenericaSubmit>): string[] {
  const msgs: string[] = []
  if (errors.cliente_id) msgs.push('Seleccioná un cliente')
  if (errors.firma_dataurl) msgs.push('Falta la firma del técnico')
  if (errors.firma_aclaracion) msgs.push('Falta la aclaración de la firma (nombre y apellido)')
  const itemErrors = errors.items
  if (Array.isArray(itemErrors)) {
    const count = itemErrors.filter(Boolean).length
    if (count > 0)
      msgs.push(`${count} ${count === 1 ? 'ítem tiene' : 'ítems tienen'} observaciones incompletas`)
  }
  return msgs
}

function valorPorDefecto(cp: CampoDef): boolean | string | number {
  if (cp.tipo_campo === 'select') return cp.opciones?.[0] ?? ''
  if (cp.tipo_campo === 'texto' || cp.tipo_campo === 'fecha' || cp.tipo_campo === 'ubicacion') return ''
  if (cp.tipo_campo === 'numero') return cp.valor_min ?? 0
  return true // check (default)
}

function buildDefaultItems(catalogo: { numero: string }[], campos: CampoDef[]) {
  return catalogo.map((c) => ({
    numero: c.numero,
    respuestas: Object.fromEntries(campos.map((cp) => [cp.clave, valorPorDefecto(cp)])),
    observaciones: Object.fromEntries(campos.map((cp) => [cp.clave, null])),
    foto_url: null,
  }))
}

interface CampoDef {
  clave: string
  etiqueta: string
  tipo_campo?: 'check' | 'select' | 'texto' | 'numero' | 'fecha' | 'ubicacion'
  opciones?: string[]
  valor_min?: number | null
  valor_max?: number | null
}

interface Props {
  tipoId: string
  tipoNombre: string
  campos: CampoDef[]
  clienteId: string | null
  clienteNombre: string | null
  turnoDefault: 'diurno' | 'nocturno'
  aclaracion?: string
  items: { numero: string }[]
  planoUrl?: string | null
}

export default function PlanillaGenericaForm({
  tipoId, tipoNombre, campos, clienteId, clienteNombre, turnoDefault, aclaracion, items: catalogo, planoUrl,
}: Props) {
  const router = useRouter()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [alreadySent, setAlreadySent] = useState(false)
  const [validationMessages, setValidationMessages] = useState<string[]>([])

  const schema = buildPlanillaGenericaSchema(campos)

  const methods = useForm<PlanillaGenericaSubmit>({
    resolver: zodResolver(schema),
    defaultValues: {
      cliente_id: clienteId ?? '',
      fecha: new Date().toISOString().split('T')[0],
      turno: turnoDefault,
      items: buildDefaultItems(catalogo, campos),
      firma_dataurl: '',
      firma_aclaracion: aclaracion ?? '',
    },
  })

  // Sincronizar si llegan tarde (SSR → hydration)
  useEffect(() => {
    if (clienteId) methods.setValue('cliente_id', clienteId, { shouldValidate: true })
    methods.setValue('turno', turnoDefault, { shouldValidate: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  function onValidationError(errs: FieldErrors<PlanillaGenericaSubmit>) {
    setValidationMessages(buildSummary(errs))
  }

  async function onSubmit(data: PlanillaGenericaSubmit) {
    setSubmitError(null)
    setValidationMessages([])
    setSubmitting(true)
    try {
      const res = await fetch(`/api/planillas/generico/${tipoId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) {
        if (res.status === 409 && json.error?.includes('Ya enviaste')) {
          setAlreadySent(true)
        } else {
          setSubmitError(json.error ?? 'Error al enviar la planilla')
        }
        return
      }
      router.refresh()
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
              Ya registraste una planilla de {tipoNombre} para este turno. No podés enviar dos planillas para el mismo turno.
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
          <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3 min-h-[52px]">
            <Building2 size={16} className="text-gray-400 shrink-0" />
            <div>
              <p className="text-xs text-gray-400">Puesto</p>
              <p className="font-semibold text-brand-ink text-sm">{clienteNombre ?? '—'}</p>
            </div>
            <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
              turnoDefault === 'diurno' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'
            }`}>{turnoDefault}</span>
          </div>

          <div>
            <label htmlFor="fecha" className="block text-sm font-medium mb-1">Fecha</label>
            <input
              id="fecha"
              type="date"
              {...register('fecha')}
              className="w-full border border-gray-300 rounded p-3 text-base min-h-[44px]"
            />
          </div>
        </div>

        {/* Lista de ítems */}
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-2 text-brand-ink">{tipoNombre}</h2>
          {planoUrl && (
            <div className="mb-3">
              <VerFotoBtn url={planoUrl} label="Ver plano de planta" />
            </div>
          )}
          {catalogo.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
              No hay ítems configurados para este puesto. Contactá a tu supervisor
              para que cargue el listado antes de enviar la planilla.
            </div>
          ) : (
            catalogo.map((_, i) => <PlanillaGenericaRow key={i} index={i} campos={campos} />)
          )}
        </div>

        {/* Firma */}
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-2 text-brand-ink">Firma del técnico</h2>
          <SignatureCanvas onChange={handleFirma} onAclaracionChange={handleAclaracion} aclaracion={aclaracion} />
          {errors.firma_dataurl && (
            <p className="text-red-600 text-sm mt-1">{errors.firma_dataurl.message}</p>
          )}
          {errors.firma_aclaracion && (
            <p className="text-red-600 text-sm mt-1">{errors.firma_aclaracion.message}</p>
          )}
        </div>

        {/* Botón sticky — encima de la nav bar */}
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 md:left-56 z-50 bg-white border-t border-gray-200 p-3">
          <div className="max-w-2xl mx-auto space-y-2">
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
