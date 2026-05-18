'use client'

import { memo } from 'react'
import { useFormContext } from 'react-hook-form'
import type { PlanillaHidrantesSubmit } from '@/lib/validations/planilla'
import { FotoUpload } from './FotoUpload'

interface Props {
  index: number
}

const CHECKS = ['gabinete', 'manga', 'lanza', 'valvula'] as const

const FIELD_CONFIG = [
  { field: 'gabinete', obs: 'obs_gabinete', label: 'Gabinete' },
  { field: 'manga',    obs: 'obs_manga',    label: 'Manga' },
  { field: 'lanza',    obs: 'obs_lanza',    label: 'Lanza' },
  { field: 'valvula',  obs: 'obs_valvula',  label: 'Válvula' },
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
      className={`min-w-[44px] min-h-[44px] rounded font-bold text-sm transition-colors ${
        value ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
      }`}
      aria-label={label}
    >
      {value ? 'SI' : 'NO'}
    </button>
  )
}

function HidranteRow({ index }: Props) {
  const {
    watch,
    setValue,
    register,
    formState: { errors },
  } = useFormContext<PlanillaHidrantesSubmit>()

  const item = watch(`items.${index}`)
  const rowErrors = errors.items?.[index]

  return (
    <div className="border-b border-gray-200 py-3">
      {/* Toggles + foto */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-mono text-sm w-14 text-brand-ink">{item.numero}</span>
        {CHECKS.map((campo) => (
          <div key={campo} className="flex flex-col items-center gap-1">
            <span className="text-xs text-gray-500 capitalize">{campo === 'valvula' ? 'Válvula' : campo.charAt(0).toUpperCase() + campo.slice(1)}</span>
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

export default memo(HidranteRow)
