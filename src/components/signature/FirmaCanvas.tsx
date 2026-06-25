'use client'

import { useRef } from 'react'
import ReactSignatureCanvas from 'react-signature-canvas'

interface Props {
  onChange: (dataUrl: string | null) => void
  label?: string
}

export default function FirmaCanvas({ onChange, label = 'Firma' }: Props) {
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
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-brand-ink">{label}</p>
      <div className="border-2 border-brand-ink rounded-lg overflow-hidden" style={{ backgroundColor: 'white' }}>
        <ReactSignatureCanvas
          ref={ref}
          penColor="#1a2d42"
          canvasProps={{
            width: 320,
            height: 140,
            className: 'w-full touch-none',
          }}
          onEnd={handleEnd}
        />
      </div>
      <button
        type="button"
        onClick={handleClear}
        className="self-end text-sm text-brand-blue underline py-1 px-2 min-h-[44px]"
      >
        Borrar
      </button>
    </div>
  )
}
