'use client'

import { useState } from 'react'
import type { Alerta } from '@/types/database'

interface Props {
  initialAlertas: Alerta[]
}

export default function AlertasClient({ initialAlertas }: Props) {
  const [alertas, setAlertas] = useState<Alerta[]>(initialAlertas)
  const [marking, setMarking] = useState<string | null>(null)

  async function markRead(id: string) {
    setMarking(id)
    const res = await fetch(`/api/alertas/${id}/read`, { method: 'PATCH' })
    if (res.ok) {
      setAlertas((prev) => prev.map((a) => (a.id === id ? { ...a, leida: true } : a)))
    }
    setMarking(null)
  }

  const noLeidas = alertas.filter((a) => !a.leida)
  const leidas = alertas.filter((a) => a.leida)

  return (
    <div className="flex flex-col gap-6">
      {noLeidas.length === 0 && (
        <p className="text-gray-500 text-sm">No hay alertas pendientes.</p>
      )}

      {noLeidas.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-red-700 mb-3 uppercase tracking-wide">
            Sin leer ({noLeidas.length})
          </h2>
          <div className="flex flex-col gap-2">
            {noLeidas.map((alerta) => (
              <div
                key={alerta.id}
                className="bg-red-50 border border-red-200 rounded-lg p-4 flex justify-between items-start gap-4"
              >
                <div>
                  <p className="text-sm text-red-800">{alerta.mensaje}</p>
                  <p className="text-xs text-red-400 mt-1">
                    {new Date(alerta.created_at).toLocaleString('es-AR')}
                  </p>
                </div>
                <button
                  onClick={() => markRead(alerta.id)}
                  disabled={marking === alerta.id}
                  className="shrink-0 text-xs bg-white border border-red-300 text-red-700 px-3 py-2 rounded min-h-[36px] hover:bg-red-50 disabled:opacity-50"
                >
                  {marking === alerta.id ? '...' : 'Leída'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {leidas.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide">
            Leídas
          </h2>
          <div className="flex flex-col gap-2">
            {leidas.map((alerta) => (
              <div
                key={alerta.id}
                className="bg-white border border-gray-100 rounded-lg p-4"
              >
                <p className="text-sm text-gray-600">{alerta.mensaje}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(alerta.created_at).toLocaleString('es-AR')}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
