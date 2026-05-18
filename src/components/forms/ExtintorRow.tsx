'use client'

import { memo } from 'react'
import { useFormContext } from 'react-hook-form'
import type { PlanillaExtintoresSubmit } from '@/lib/validations/extintor'
import { FotoUpload } from './FotoUpload'

export const TIPOS_EXTINTOR = ['ABC', 'BC', 'CO2', 'Agua', 'AFFF', 'K', 'Halotron'] as const

interface Props {
  index: number
}

const CHECKS = ['senalizacion', 'acceso', 'presion_peso'] as const

const CHECK_LABELS: Record<typeof CHECKS[number], string> = {
  senalizacion: 'Señal.',
  acceso: 'Acceso',
  presion_peso: 'Pres/Pes',
}

const FIELD_CONFIG = [
  { field: 'senalizacion',  obs: 'obs_senalizacion',  label: 'Señalización' },
  { field: 'acceso',        obs: 'obs_acceso',        label: 'Acceso' },
  { field: 'presion_peso',  obs: 'obs_presion_peso',  label: 'Presión/Peso' },
] as const

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
      className={`min-w-[52px] min-h-[44px] rounded font-bold text-sm transition-colors ${
        value ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
      }`}
      aria-label={label}
    >
      {value ? 'SI' : 'NO'}
    </button>
  )
}

function ExtintorRow({ index }: Props) {
  const {
    watch,
    setValue,
    register,
    formState: { errors },
  } = useFormContext<PlanillaExtintoresSubmit>()

  const item = watch(`items.${index}`)
  const rowErrors = errors.items?.[index]
  const tipoError = rowErrors?.tipo

  return (
    <div className="border-b border-gray-200 py-3">
      {/* Número + tipo + toggles + foto */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-sm w-14 shrink-0 text-brand-ink">{item.numero}</span>

        {/* Tipo — dropdown grande */}
        <select
          {...register(`items.${index}.tipo`)}
          className={`border rounded p-2 text-sm min-h-[44px] w-28 ${
            tipoError ? 'border-red-400 bg-red-50' : 'border-gray-300'
          }`}
        >
          <option value="">Tipo…</option>
          {TIPOS_EXTINTOR.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {CHECKS.map((campo) => (
          <div key={campo} className="flex flex-col items-center gap-1">
            <span className="text-xs text-gray-500">{CHECK_LABELS[campo]}</span>
            <Toggle
              value={item[campo]}
              onChange={(v) => setValue(`items.${index}.${campo}`, v, { shouldValidate: true })}
              label={`${item.numero} ${campo}`}
            />
          </div>
        ))}

        <FotoUpload
          value={item.foto_url}
          onChange={(path) => setValue(`items.${index}.foto_url`, path, { shouldValidate: false })}
        />
      </div>

      {tipoError && (
        <p className="text-red-600 text-xs mt-1">{tipoError.message as string}</p>
      )}

      {/* Una textarea por cada campo en NO */}
      {FIELD_CONFIG.map(({ field, obs, label }) => {
        if (item[field]) return null
        const obsKey = `items.${index}.${obs}` as const
        const fieldError = rowErrors?.[obs]
        return (
          <div key={obs} className="mt-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {label} — observación <span className="text-red-500">(obligatorio)</span>
            </label>
            <textarea
              {...register(obsKey)}
              rows={2}
              className={`w-full border rounded p-2 text-base min-h-[44px] ${
                fieldError ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
            />
            {fieldError && (
              <p className="text-red-600 text-sm mt-1">{fieldError.message as string}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default memo(ExtintorRow)
