'use client'

import { useRef, useState } from 'react'
import { Camera, X, Loader2, CheckCircle } from 'lucide-react'

interface Props {
  value: string | null | undefined
  onChange: (path: string | null) => void
}

export function FotoUpload({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setUploading(true)
    setError(null)

    const localUrl = URL.createObjectURL(file)
    setPreview(localUrl)

    const fd = new FormData()
    fd.append('file', file)

    try {
      const res = await fetch('/api/upload/foto', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Error al subir')
      onChange(data.path)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir')
      setPreview(null)
      onChange(null)
    } finally {
      setUploading(false)
    }
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation()
    setPreview(null)
    setError(null)
    onChange(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const hasPhoto = preview || value

  return (
    <div className="flex flex-col items-start gap-1">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />

      {hasPhoto ? (
        <div className="relative">
          {preview ? (
            <img
              src={preview}
              alt="Foto"
              className="w-14 h-14 object-cover rounded-lg border border-gray-200"
            />
          ) : (
            <div className="w-14 h-14 rounded-lg border border-green-300 bg-green-50 flex items-center justify-center">
              <CheckCircle size={20} className="text-green-600" />
            </div>
          )}
          <button
            type="button"
            onClick={clear}
            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow"
          >
            <X size={10} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1 text-xs text-gray-500 border border-dashed border-gray-300 rounded-lg px-2 py-1 min-h-[44px] min-w-[44px] hover:bg-gray-50 active:bg-gray-100 transition-colors"
        >
          {uploading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Camera size={16} />
          )}
          <span className="sr-only sm:not-sr-only">
            {uploading ? 'Subiendo...' : 'Foto'}
          </span>
        </button>
      )}

      {error && <p className="text-red-500 text-xs">{error}</p>}
    </div>
  )
}
