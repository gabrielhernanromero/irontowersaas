'use client'

import { useEffect, useRef, useState } from 'react'
import { X, ZoomIn, ImageOff, Loader2, Camera } from 'lucide-react'

// ── Lightbox full-screen ──────────────────────────────────────────────────────

interface LightboxProps {
  url: string
  alt?: string
  onClose: () => void
}

export default function FotoLightbox({ url, alt = 'Foto', onClose }: LightboxProps) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')

  // Cerrar con ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Swipe-down para cerrar en mobile
  const startY = useRef<number | null>(null)
  function onTouchStart(e: React.TouchEvent) { startY.current = e.touches[0].clientY }
  function onTouchEnd(e: React.TouchEvent) {
    if (startY.current === null) return
    const delta = e.changedTouches[0].clientY - startY.current
    if (delta > 80) onClose()
    startY.current = null
  }

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/92 flex items-center justify-center p-4"
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Botón cerrar */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center z-10"
        aria-label="Cerrar foto"
      >
        <X size={20} />
      </button>

      {/* Hint swipe */}
      <p className="absolute top-4 left-1/2 -translate-x-1/2 text-white/40 text-xs pointer-events-none select-none">
        Deslizá hacia abajo para cerrar
      </p>

      {/* Spinner mientras carga */}
      {status === 'loading' && (
        <Loader2 size={32} className="text-white/60 animate-spin absolute" />
      )}

      {/* Error state */}
      {status === 'error' && (
        <div className="flex flex-col items-center gap-3 text-white/60">
          <ImageOff size={40} />
          <p className="text-sm">No se pudo cargar la foto</p>
        </div>
      )}

      {/* La imagen */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        className={`max-w-full max-h-[88vh] object-contain rounded-xl shadow-2xl transition-opacity duration-200 ${
          status === 'ok' ? 'opacity-100' : 'opacity-0 absolute'
        }`}
        onLoad={() => setStatus('ok')}
        onError={() => setStatus('error')}
        onClick={e => e.stopPropagation()}
      />
    </div>
  )
}

// ── Thumbnail clickeable ──────────────────────────────────────────────────────

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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Foto adjunta"
        className="w-full h-full object-cover"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-black/0 group-active:bg-black/30 transition-colors flex items-center justify-center">
        <ZoomIn size={18} className="text-white opacity-0 group-active:opacity-100 transition-opacity" />
      </div>
    </button>
  )
}

// ── Botón "Ver foto" lazy (sin cargar la imagen hasta que se toca) ───────────

export function VerFotoBtn({
  url,
  label = 'Ver foto',
}: {
  url: string
  label?: string
}) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  return (
    <>
      <button
        type="button"
        onClick={() => setLightboxUrl(url)}
        className="flex items-center gap-2 text-sm text-brand-blue font-semibold py-2 px-3 rounded-xl bg-blue-50 border border-blue-100 active:bg-blue-100 min-h-[44px] w-full justify-center"
      >
        <Camera size={16} />
        {label}
      </button>

      {lightboxUrl && (
        <FotoLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}
    </>
  )
}

// ── Ícono de cámara inline (badge pequeño en listas) ─────────────────────────

export function FotoBadge() {
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600 shrink-0"
      title="Tiene foto adjunta"
    >
      <Camera size={11} />
    </span>
  )
}
