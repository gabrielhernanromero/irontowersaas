'use client'

import { useState, useEffect, useCallback } from 'react'
import { getPendingCount } from './db'
import { syncPendingQueue } from './sync'

export function useOfflineStatus() {
  const [isOnline, setIsOnline]       = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing]         = useState(false)

  const refreshCount = useCallback(async () => {
    try {
      const n = await getPendingCount()
      setPendingCount(n)
    } catch { /* indexedDB not available */ }
  }, [])

  const triggerSync = useCallback(async () => {
    if (syncing) return
    setSyncing(true)
    try {
      await syncPendingQueue()
      await refreshCount()
    } finally {
      setSyncing(false)
    }
  }, [syncing, refreshCount])

  useEffect(() => {
    setIsOnline(navigator.onLine)
    refreshCount()

    const onOnline = () => {
      setIsOnline(true)
      triggerSync()
    }
    const onOffline = () => setIsOnline(false)

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    // Listen for SW messages
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'SYNC_QUEUE') triggerSync()
    }
    navigator.serviceWorker?.addEventListener('message', onMessage)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      navigator.serviceWorker?.removeEventListener('message', onMessage)
    }
  }, [refreshCount, triggerSync])

  return { isOnline, pendingCount, syncing, refreshCount }
}
