'use client'

import { useEffect } from 'react'
import { posthog } from '@/lib/posthog/client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    posthog.capture('$exception', {
      message: error.message,
      stack: error.stack,
      digest: error.digest,
    })
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-xl font-semibold text-gray-800">Algo salió mal</h2>
      <p className="text-sm text-gray-500">El error fue reportado automáticamente.</p>
      <button
        onClick={reset}
        className="rounded-lg bg-orange-500 px-4 py-2 text-white text-sm font-medium"
      >
        Intentar de nuevo
      </button>
    </div>
  )
}
