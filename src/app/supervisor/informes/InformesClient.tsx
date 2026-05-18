'use client'

import { useState } from 'react'
import { FileText, Send } from 'lucide-react'

interface PlanillaRow {
  id: string
  tipo: string
  fecha: string
  turno: string
  enviada_at: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  users: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientes: any
}

interface Props {
  planillas: PlanillaRow[]
}

export default function InformesClient({ planillas }: Props) {
  const [sending, setSending] = useState<string | null>(null)
  const [sent, setSent] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  async function handleEnviar(id: string) {
    setSending(id)
    setError(null)
    const res = await fetch(`/api/informes/${id}/enviar`, { method: 'POST' })
    if (res.ok) {
      setSent((prev) => new Set(prev).add(id))
    } else {
      const json = await res.json()
      setError(json.error ?? 'Error al enviar el informe')
    }
    setSending(null)
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {!planillas.length && (
        <p className="text-gray-500 text-sm">No hay planillas enviadas aún.</p>
      )}

      {planillas.map((p) => (
        <div
          key={p.id}
          className="bg-white border border-gray-100 rounded-xl p-4 flex justify-between items-center gap-4"
        >
          <div>
            <p className="font-medium text-brand-ink capitalize">{p.tipo}</p>
            <p className="text-sm text-gray-500">
              {p.clientes?.nombre_empresa}
            </p>
            <p className="text-xs text-gray-400">
              {p.fecha} · {p.turno} · {p.users?.nombre} {p.users?.apellido}
            </p>
          </div>

          <div className="flex gap-2 shrink-0">
            <a
              href={`/api/informes/${p.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm bg-gray-100 hover:bg-gray-200 text-brand-ink px-3 py-2 rounded min-h-[44px]"
            >
              <FileText size={15} />
              Ver PDF
            </a>

            <button
              onClick={() => handleEnviar(p.id)}
              disabled={sending === p.id || sent.has(p.id)}
              className="flex items-center gap-1 text-sm bg-brand-orange hover:bg-orange-600 text-white px-3 py-2 rounded min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={15} />
              {sent.has(p.id) ? 'Enviado ✓' : sending === p.id ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
