'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
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
    <html lang="es">
      <body>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-sm w-full text-center">
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={28} className="text-red-600" />
            </div>
            <h1 className="font-bold text-brand-ink text-lg mb-2">Ocurrió un error</h1>
            <p className="text-sm text-gray-500 mb-6">
              El error fue reportado automáticamente. Podés intentar recargar la página.
            </p>
            <button
              onClick={reset}
              className="w-full bg-brand-orange text-white font-bold py-3 rounded-xl"
            >
              Recargar
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
