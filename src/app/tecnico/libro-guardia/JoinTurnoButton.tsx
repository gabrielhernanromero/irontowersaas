'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Loader2, AlertCircle } from 'lucide-react'

interface Props {
  esquemaId: string
}

export default function JoinTurnoButton({ esquemaId }: Props) {
  const router = useRouter()
  const [cargando, setCargando] = useState(false)
  const [error, setError]       = useState('')

  const handleJoin = async () => {
    setCargando(true)
    setError('')
    try {
      const res = await fetch('/api/libro-turno/join', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ esquema_id: esquemaId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error al unirse al turno')
        return
      }
      router.refresh()
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-2.5 text-xs">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
      <button
        onClick={handleJoin}
        disabled={cargando}
        className="flex items-center justify-center gap-2 w-full bg-blue-600 text-white font-bold py-3 rounded-xl text-sm min-h-[48px] disabled:opacity-60"
      >
        {cargando ? <Loader2 size={18} className="animate-spin" /> : <Users size={18} />}
        {cargando ? 'Buscando turno…' : 'Unirme al turno activo'}
      </button>
    </div>
  )
}
