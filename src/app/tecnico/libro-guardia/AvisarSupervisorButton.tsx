'use client'

import { useState } from 'react'
import { BellRing, CheckCircle2, Loader2 } from 'lucide-react'

interface Props {
  turnoBlockeanteId: string
  yaAvisado: boolean
}

export default function AvisarSupervisorButton({ turnoBlockeanteId, yaAvisado: initialYaAvisado }: Props) {
  const [estado, setEstado] = useState<'idle' | 'loading' | 'enviado' | 'error'>(
    initialYaAvisado ? 'enviado' : 'idle'
  )
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleAvisar() {
    setEstado('loading')
    setErrorMsg(null)
    try {
      const res = await fetch('/api/libro-turno/avisar-bloqueo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turnoBlockeanteId }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErrorMsg(json.error ?? 'Error al enviar el aviso')
        setEstado('error')
        return
      }
      setEstado('enviado')
    } catch {
      setErrorMsg('Error de conexión')
      setEstado('error')
    }
  }

  if (estado === 'enviado') {
    return (
      <div className="flex items-center gap-2 mt-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
        <CheckCircle2 size={16} className="shrink-0" />
        Supervisor avisado. Esperá que cierre el turno anterior.
      </div>
    )
  }

  return (
    <div className="mt-3">
      <button
        onClick={handleAvisar}
        disabled={estado === 'loading'}
        className="w-full flex items-center justify-center gap-2 bg-red-600 text-white font-semibold py-3 rounded-lg text-sm min-h-[48px] disabled:opacity-60 active:bg-red-700"
      >
        {estado === 'loading'
          ? <><Loader2 size={16} className="animate-spin" /> Enviando aviso...</>
          : <><BellRing size={16} /> Avisar al supervisor</>
        }
      </button>
      {estado === 'error' && errorMsg && (
        <p className="text-xs text-red-600 mt-1 text-center">{errorMsg}</p>
      )}
    </div>
  )
}
