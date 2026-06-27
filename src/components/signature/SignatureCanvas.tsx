'use client'

import { useRef } from 'react'
import ReactSignatureCanvas from 'react-signature-canvas'

interface Props {
  onChange: (dataUrl: string | null) => void
  onAclaracionChange: (val: string) => void
  aclaracion?: string  // si se pasa, el campo es de solo lectura con este valor
}

export default function SignatureCanvas({ onChange, onAclaracionChange, aclaracion }: Props) {
  const ref = useRef<ReactSignatureCanvas>(null)

  function handleEnd() {
    if (ref.current?.isEmpty()) {
      onChange(null)
    } else {
      onChange(ref.current?.toDataURL('image/png') ?? null)
    }
  }

  function handleClear() {
    ref.current?.clear()
    onChange(null)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="border-2 border-brand-ink rounded-lg overflow-hidden" style={{ backgroundColor: 'white' }}>
        <ReactSignatureCanvas
          ref={ref}
          penColor="#1a2d42"
          canvasProps={{
            width: 320,
            height: 160,
            className: 'w-full touch-none',
          }}
          onEnd={handleEnd}
        />
      </div>
      <button
        type="button"
        onClick={handleClear}
        className="self-end text-sm text-brand-blue underline py-2 px-3 min-h-[44px]"
      >
        Borrar firma
      </button>
      <div>
        <label className="block text-sm font-medium text-brand-ink mb-1">
          Aclaración
        </label>
        {aclaracion ? (
          <div className="w-full border border-gray-200 bg-gray-50 rounded p-3 text-base min-h-[44px] text-brand-ink">
            {aclaracion}
          </div>
        ) : (
          <input
            id="firma_aclaracion"
            type="text"
            placeholder="Nombre y apellido"
            onChange={(e) => onAclaracionChange(e.target.value)}
            className="w-full border border-gray-300 rounded p-3 text-base min-h-[44px] focus:outline-none focus:ring-2 focus:ring-brand-blue"
          />
        )}
      </div>
    </div>
  )
}
