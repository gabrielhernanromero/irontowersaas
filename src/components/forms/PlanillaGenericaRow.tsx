'use client'

import { memo } from 'react'
import { useFormContext } from 'react-hook-form'
import type { PlanillaGenericaSubmit } from '@/lib/validations/planillaGenerica'
import { respuestaEsNovedad } from '@/lib/validations/planillaGenerica'
import { FotoUpload } from './FotoUpload'

interface CampoDef {
  clave: string
  etiqueta: string
  tipo_campo?: 'check' | 'select' | 'texto' | 'numero' | 'fecha' | 'ubicacion'
  opciones?: string[]
  valor_min?: number | null
  valor_max?: number | null
}

interface Props {
  index: number
  campos: CampoDef[]
}

function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`min-w-[44px] min-h-[44px] rounded font-bold text-sm transition-colors ${
        value ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
      }`}
      aria-label={label}
    >
      {value ? 'SI' : 'NO'}
    </button>
  )
}

function PlanillaGenericaRow({ index, campos }: Props) {
  const {
    watch,
    setValue,
    register,
    formState: { errors },
  } = useFormContext<PlanillaGenericaSubmit>()

  const item = watch(`items.${index}`)
  const rowErrors = errors.items?.[index]

  return (
    <div className="border-b border-gray-200 py-3">
      {/* Controles por campo + foto */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-mono text-sm w-14 text-brand-ink">{item.numero}</span>
        {campos.map((campo) => (
          <div key={campo.clave} className="flex flex-col items-center gap-1">
            <span className="text-sm text-gray-500">{campo.etiqueta}</span>
            {campo.tipo_campo === 'select' ? (
              <select
                value={typeof item.respuestas[campo.clave] === 'string' ? (item.respuestas[campo.clave] as string) : ''}
                onChange={(e) => setValue(`items.${index}.respuestas.${campo.clave}` as never, e.target.value as never, { shouldValidate: true })}
                className="min-h-[44px] border border-gray-300 rounded px-2 text-sm"
              >
                {(campo.opciones ?? []).map((op) => <option key={op} value={op}>{op}</option>)}
              </select>
            ) : campo.tipo_campo === 'texto' || campo.tipo_campo === 'ubicacion' ? (
              <input
                type="text"
                value={typeof item.respuestas[campo.clave] === 'string' ? (item.respuestas[campo.clave] as string) : ''}
                onChange={(e) => setValue(`items.${index}.respuestas.${campo.clave}` as never, e.target.value as never, { shouldValidate: true })}
                className="min-h-[44px] border border-gray-300 rounded px-2 text-sm w-32"
              />
            ) : campo.tipo_campo === 'fecha' ? (
              <input
                type="date"
                value={typeof item.respuestas[campo.clave] === 'string' ? (item.respuestas[campo.clave] as string) : ''}
                onChange={(e) => setValue(`items.${index}.respuestas.${campo.clave}` as never, e.target.value as never, { shouldValidate: true })}
                className="min-h-[44px] border border-gray-300 rounded px-2 text-sm"
              />
            ) : campo.tipo_campo === 'numero' ? (
              <input
                type="number"
                inputMode="decimal"
                min={campo.valor_min ?? undefined}
                max={campo.valor_max ?? undefined}
                value={typeof item.respuestas[campo.clave] === 'number' ? (item.respuestas[campo.clave] as number) : ''}
                onChange={(e) => setValue(`items.${index}.respuestas.${campo.clave}` as never, e.target.valueAsNumber as never, { shouldValidate: true })}
                className="min-h-[44px] border border-gray-300 rounded px-2 text-sm w-20"
              />
            ) : (
              <Toggle
                value={item.respuestas[campo.clave] as boolean}
                onChange={(v) => setValue(`items.${index}.respuestas.${campo.clave}` as never, v as never, { shouldValidate: true })}
                label={`${item.numero} ${campo.etiqueta}`}
              />
            )}
          </div>
        ))}
        <FotoUpload
          value={item.foto_url}
          onChange={(path) => setValue(`items.${index}.foto_url`, path, { shouldValidate: false })}
        />
      </div>

      {/* Una textarea por cada campo que sea novedad (check en NO, o numérico fuera
          de rango) — select/texto/fecha nunca la necesitan. Mismo criterio que usa
          el backend (respuestaEsNovedad), para que la UI nunca oculte un campo de
          observación que el servidor después va a exigir. */}
      {campos.map((campo) => {
        if (!respuestaEsNovedad(campo, item.respuestas[campo.clave])) return null
        const { clave, etiqueta } = campo
        const obsKey = `items.${index}.observaciones.${clave}` as const
        const fieldError = (rowErrors?.observaciones as Record<string, { message?: string }> | undefined)?.[clave]
        return (
          <div key={clave} className="mt-2">
            <label className="block text-sm font-medium text-gray-600 mb-1">
              {etiqueta} — observación <span className="text-red-500">(obligatorio)</span>
            </label>
            <textarea
              {...register(obsKey as never)}
              rows={2}
              className={`w-full border rounded p-2 text-base min-h-[44px] ${
                fieldError ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
            />
            {fieldError?.message && (
              <p className="text-red-600 text-sm mt-1">{fieldError.message}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default memo(PlanillaGenericaRow)
