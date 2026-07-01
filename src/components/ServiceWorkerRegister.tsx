'use client'

import { useEffect } from 'react'
import { syncPendingQueue } from '@/lib/offline/sync'

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // En desarrollo el SW cachea chunks de webpack que cambian en cada recompilación
    // y causa errores "options.factory is undefined". Se desregistra para evitarlo.
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations()
        .then(regs => regs.forEach(r => r.unregister()))
        .catch(() => {})
      return
    }

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(reg => {
        // Intentar sync inmediato al registrar (por si hay pendientes de sesión anterior)
        if ('SyncManager' in window) {
          // Background Sync API — not yet in TS lib
          ;(reg as unknown as { sync: { register(tag: string): Promise<void> } }).sync
            .register('sync-queue').catch(() => {})
        }
      })
      .catch(err => console.error('[SW] Error al registrar:', err))

    // El SW nos avisa cuando hay sync
    const onMessage = async (e: MessageEvent) => {
      if (e.data?.type === 'SYNC_QUEUE') {
        await syncPendingQueue()
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)

    // Sync al volver online (fallback cuando no hay SyncManager)
    const onOnline = () => {
      syncPendingQueue().catch(() => {})
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready
          .then(reg => {
            if ('SyncManager' in window) {
              ;(reg as unknown as { sync: { register(tag: string): Promise<void> } }).sync
                .register('sync-queue').catch(() => {})
            }
          })
          .catch(() => {})
      }
    }
    window.addEventListener('online', onOnline)

    return () => {
      navigator.serviceWorker.removeEventListener('message', onMessage)
      window.removeEventListener('online', onOnline)
    }
  }, [])

  return null
}
