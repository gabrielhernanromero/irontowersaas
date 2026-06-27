'use client'

import { useState, useCallback, useEffect } from 'react'
import { useForm, FormProvider, FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { AlertTriangle, XCircle, ClipboardList, Eye, EyeOff, Building2 } from 'lucide-react'
import {
  PlanillaExtintoresSubmitSchema,
  type PlanillaExtintoresSubmit,
} from '@/lib/validations/extintor'
import ExtintorRow, { TIPOS_EXTINTOR } from './ExtintorRow'
import SignatureCanvas from '@/components/signature/SignatureCanvas'

const DEFAULT_TOTAL = 10

function buildItem(i: number) {
  return {
    numero: `E-${String(i + 1).padStart(3, '0')}`,
    tipo: '',
    senalizacion: true,
    acceso: true,
    presion_peso: true,
    obs_senalizacion: null,
    obs_acceso: null,
    obs_presion_peso: null,
    foto_url: null,
  }
}

function buildSummary(errors: FieldErrors<PlanillaExtintoresSubmit>): string[] {
  const msgs: string[] = []
  if (errors.cliente_id) msgs.push('Seleccioná un cliente')
  if (errors.firma_dataurl) msgs.push('Falta la firma del técnico')
  if (errors.firma_aclaracion) msgs.push('Falta la aclaración de la firma (nombre y apellido)')
  const itemErrors = errors.items
  if (Array.isArray(itemErrors)) {
    const sinTipo = itemErrors.filter((e) => e?.tipo).length
    const sinObs = itemErrors.filter((e) => e && !e.tipo).length
    if (sinTipo > 0) msgs.push(`${sinTipo} ${sinTipo === 1 ? 'extintor sin tipo asignado' : 'extintores sin tipo asignado'}`)
    if (sinObs > 0) msgs.push(`${sinObs} ${sinObs === 1 ? 'extintor tiene' : 'extintores tienen'} observaciones incompletas`)
  }
  return msgs
}

interface Props {
  clienteId: string | null
  clienteNombre: string | null
  turnoDefault: 'diurno' | 'nocturno'
  aclaracion?: string
}

export default function ExtintoresForm({ clienteId, clienteNombre, turnoDefault, aclaracion }: Props) {
  const router = useRouter()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [alreadySent, setAlreadySent] = useState(false)
  const [validationMessages, setValidationMessages] = useState<string[]>([])
  const [totalExtintores, setTotalExtintores] = useState(DEFAULT_TOTAL)
  const [tipoDefault, setTipoDefault] = useState<string>('ABC')
  const [soloNovedades, setSoloNovedades] = useState(false)

  const methods = useForm<PlanillaExtintoresSubmit>({
    resolver: zodResolver(PlanillaExtintoresSubmitSchema),
    defaultValues: {
      cliente_id: clienteId ?? '',
      fecha: new Date().toISOString().split('T')[0],
      turno: turnoDefault,
      items: Array.from({ length: DEFAULT_TOTAL }, (_, i) => buildItem(i)),
      firma_dataurl: '',
      firma_aclaracion: aclaracion ?? '',
    },
  })

  useEffect(() => {
    if (clienteId) methods.setValue('cliente_id', clienteId, { shouldValidate: true })
    methods.setValue('turno', turnoDefault, { shouldValidate: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { register, handleSubmit, setValue, watch, formState: { errors } } = methods

  const items = watch('items')

  // Cambia la cantidad de extintores preservando los ya completados
  function handleCantidad(n: number) {
    if (n < 1 || n > 500) return
    const current = methods.getValues('items')
    const next = Array.from({ length: n }, (_, i) => current[i] ?? buildItem(i))
    setValue('items', next)
    setTotalExtintores(n)
  }

  // Aplica el tipo seleccionado a TODOS los extintores (sin excepción)
  function handleAplicarTipo() {
    const current = methods.getValues('items')
    current.forEach((_, i) => {
      setValue(`items.${i}.tipo`, tipoDefault, { shouldValidate: false })
    })
  }

  const handleFirma = useCallback(
    (dataUrl: string | null) => setValue('firma_dataurl', dataUrl ?? '', { shouldValidate: true }),
    [setValue]
  )

  const handleAclaracion = useCallback(
    (val: string) => setValue('firma_aclaracion', val, { shouldValidate: true }),
    [setValue]
  )

  function onValidationError(errs: FieldErrors<PlanillaExtintoresSubmit>) {
    setValidationMessages(buildSummary(errs))
  }

  async function onSubmit(data: PlanillaExtintoresSubmit) {
    setSubmitError(null)
    setValidationMessages([])
    setSubmitting(true)
    try {
      const res = await fetch('/api/planillas/extintores', {
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

  // Índices visibles según filtro
  const indicesVisibles = items
    .map((item, i) => ({ item, i }))
    .filter(({ item }) =>
      soloNovedades
        ? !item.senalizacion || !item.acceso || !item.presion_peso || !item.tipo
        : true
    )

  const cantNovedades = items.filter(
    (item) => !item.senalizacion || !item.acceso || !item.presion_peso
  ).length

  return (
    <FormProvider {...methods}>
      {/* Modal: planilla ya enviada */}
      {alreadySent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
            <XCircle className="mx-auto mb-3 text-red-500" size={48} />
            <h2 className="text-lg font-bold text-brand-ink mb-2">Planilla ya enviada</h2>
            <p className="text-gray-600 text-sm mb-5">
              Ya registraste una planilla de extintores para este turno. No podés enviar dos planillas para el mismo turno.
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
          {/* Puesto y turno — vienen del turno activo, no editables */}
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

        {/* Controles de la lista */}
        <div className="bg-gray-50 rounded-xl p-3 mb-4 flex flex-col gap-3">
          {/* Cantidad */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-brand-ink shrink-0">
              Cantidad de extintores
            </label>
            <input
              type="number"
              min={1}
              max={500}
              value={totalExtintores}
              onChange={(e) => handleCantidad(Number(e.target.value))}
              className="border border-gray-300 rounded p-2 text-base w-20 min-h-[44px] text-center"
            />
          </div>

          {/* Bulk tipo */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-brand-ink shrink-0">Tipo predominante</label>
            <select
              value={tipoDefault}
              onChange={(e) => setTipoDefault(e.target.value)}
              className="border border-gray-300 rounded p-2 text-sm min-h-[44px] flex-1"
            >
              {TIPOS_EXTINTOR.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAplicarTipo}
              className="bg-brand-blue text-white px-3 py-2 rounded text-sm font-medium min-h-[44px] shrink-0"
            >
              Aplicar a todos
            </button>
          </div>

          {/* Filtro novedades */}
          <button
            type="button"
            onClick={() => setSoloNovedades(!soloNovedades)}
            className={`flex items-center justify-center gap-2 w-full py-2 rounded text-sm font-medium min-h-[44px] border transition-colors ${
              soloNovedades
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-white text-gray-700 border-gray-300'
            }`}
          >
            {soloNovedades ? <EyeOff size={16} /> : <Eye size={16} />}
            {soloNovedades
              ? `Mostrando solo novedades (${indicesVisibles.length})`
              : `Ver solo novedades${cantNovedades > 0 ? ` (${cantNovedades})` : ''}`}
          </button>
        </div>

        {/* Lista de extintores */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-semibold text-brand-ink">Extintores</h2>
            <span className="text-xs text-gray-400">{totalExtintores} en total</span>
          </div>

          {soloNovedades && indicesVisibles.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">
              Sin novedades registradas aún
            </div>
          )}

          {indicesVisibles.map(({ i }) => (
            <ExtintorRow key={i} index={i} />
          ))}
        </div>

        {/* Firma */}
        <div className="mb-6 mt-6">
          <h2 className="text-base font-semibold mb-2 text-brand-ink">Firma del técnico</h2>
          <SignatureCanvas onChange={handleFirma} onAclaracionChange={handleAclaracion} aclaracion={aclaracion} />
          {errors.firma_dataurl && (
            <p className="text-red-600 text-sm mt-1">{errors.firma_dataurl.message}</p>
          )}
          {errors.firma_aclaracion && (
            <p className="text-red-600 text-sm mt-1">{errors.firma_aclaracion.message}</p>
          )}
        </div>

        {/* Botón sticky */}
        <div className="fixed bottom-16 left-0 right-0 z-50 bg-white border-t border-gray-200 p-3">
          <div className="max-w-[430px] mx-auto space-y-2">
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
              {submitting ? 'Enviando...' : `Enviar Planilla (${totalExtintores} extintores)`}
            </button>
          </div>
        </div>
      </form>
    </FormProvider>
  )
}
