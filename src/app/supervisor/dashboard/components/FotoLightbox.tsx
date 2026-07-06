'use client'

import { X, ZoomIn } from 'lucide-react'
import { useEffect } from 'react'

interface Props {
  url: string
  alt?: string
  onClose: () => void
}

export default function FotoLightbox({ url, alt = 'Foto', onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Cerrar foto"
      >
        <X size={20} />
      </button>
      <img
        src={url}
        alt={alt}
        className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      />
    </div>
  )
}

// Thumbnail clickeable que abre el lightbox
export function FotoThumb({
  url,
  onClick,
  className = '',
}: {
  url: string
  onClick: () => void
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`relative group overflow-hidden rounded-lg border border-gray-200 ${className}`}
      aria-label="Ver foto"
    >
      <img
        src={url}
        alt="Foto adjunta"
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
        <ZoomIn size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  )
}
