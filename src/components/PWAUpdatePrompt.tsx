'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

export default function PWAUpdatePrompt() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.ready.then(reg => {
      // Si ya hay un SW esperando al montar (recarga posterior al deploy)
      if (reg.waiting) {
        setWaiting(reg.waiting)
      }

      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing
        if (!newSW) return

        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            // Nuevo SW instalado pero esperando activarse
            setWaiting(newSW)
          }
        })
      })
    })

    // Cuando el SW activo cambia (skipWaiting desde otro tab), recargar
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true
        window.location.reload()
      }
    })
  }, [])

  function applyUpdate() {
    if (!waiting) return
    waiting.postMessage({ type: 'SKIP_WAITING' })
    setWaiting(null)
  }

  if (!waiting) return null

  return (
    <div className="fixed bottom-20 left-0 right-0 z-[250] flex justify-center px-4 pointer-events-none">
      <div className="bg-brand-ink text-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3 max-w-sm w-full pointer-events-auto">
        <RefreshCw size={16} className="shrink-0 text-brand-orange" />
        <p className="flex-1 text-sm font-medium">Nueva versión disponible</p>
        <button
          onClick={applyUpdate}
          className="shrink-0 bg-brand-orange text-white text-xs font-bold px-3 py-2 rounded-lg min-h-[36px]"
        >
          Actualizar
        </button>
      </div>
    </div>
  )
}
