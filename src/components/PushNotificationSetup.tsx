'use client'

import { useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr.buffer
}

type Estado = 'loading' | 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'

export default function PushNotificationSetup() {
  const [estado, setEstado]     = useState<Estado>('loading')
  const [cerrado, setCerrado]   = useState(false)
  const [working, setWorking]   = useState(false)

  useEffect(() => {
    if (!VAPID_PUBLIC_KEY) { setEstado('unsupported'); return }
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setEstado('unsupported')
      return
    }
    if (Notification.permission === 'denied') { setEstado('denied'); return }

    navigator.serviceWorker.ready.then(reg =>
      reg.pushManager.getSubscription().then(sub => {
        setEstado(sub ? 'subscribed' : 'unsubscribed')
      })
    )
  }, [])

  async function activar() {
    setWorking(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setEstado('denied'); return }

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      await fetch('/api/push/subscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(sub.toJSON()),
      })

      setEstado('subscribed')
    } catch (err) {
      console.error('[Push] Error al suscribirse:', err)
    } finally {
      setWorking(false)
    }
  }

  // No mostrar nada en estos casos
  if (estado === 'loading' || estado === 'unsupported' || estado === 'subscribed' || estado === 'denied' || cerrado) {
    return null
  }

  return (
    <div className="fixed top-0 left-0 right-0 md:left-56 z-[100] bg-brand-ink text-white shadow-lg animate-slide-down">
      <div className="flex items-center gap-3 px-4 py-3">
        <Bell size={18} className="shrink-0 text-brand-orange" />
        <p className="flex-1 text-sm font-medium leading-tight">
          Activar notificaciones para recibir alertas
        </p>
        <button
          onClick={activar}
          disabled={working}
          className="shrink-0 bg-brand-orange text-white text-xs font-bold px-3 py-2 rounded-lg min-h-[36px] disabled:opacity-60"
        >
          {working ? '...' : 'Activar'}
        </button>
        <button
          onClick={() => setCerrado(true)}
          className="shrink-0 text-gray-400 p-1 min-h-[36px] min-w-[36px] flex items-center justify-center"
          aria-label="Cerrar"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
