'use client'

import { useOfflineStatus } from '@/lib/offline/useOfflineStatus'
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react'

export default function OfflineBanner() {
  const { isOnline, pendingCount, syncing } = useOfflineStatus()

  // Online y sin pendientes: invisible
  if (isOnline && pendingCount === 0) return null

  // Sincronizando
  if (isOnline && syncing) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[200] bg-blue-600 text-white">
        <div className="max-w-[430px] mx-auto flex items-center gap-3 px-4 py-2.5">
          <RefreshCw size={15} className="shrink-0 animate-spin" />
          <p className="text-xs font-semibold">Enviando datos guardados offline...</p>
        </div>
      </div>
    )
  }

  // Online con pendientes listos para enviar (se disparará solo)
  if (isOnline && pendingCount > 0) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[200] bg-emerald-600 text-white">
        <div className="max-w-[430px] mx-auto flex items-center gap-3 px-4 py-2.5">
          <CheckCircle2 size={15} className="shrink-0" />
          <p className="text-xs font-semibold">
            {pendingCount} {pendingCount === 1 ? 'registro enviado' : 'registros enviados'} correctamente
          </p>
        </div>
      </div>
    )
  }

  // Offline
  return (
    <div className="fixed top-0 left-0 right-0 z-[200] bg-gray-900 text-white">
      <div className="max-w-[430px] mx-auto flex items-center gap-3 px-4 py-2.5">
        <WifiOff size={15} className="shrink-0 text-red-400" />
        <p className="text-xs font-semibold">
          Sin conexión — los datos se guardan localmente
          {pendingCount > 0 && (
            <span className="ml-1 text-amber-300">({pendingCount} pendientes)</span>
          )}
        </p>
      </div>
    </div>
  )
}
