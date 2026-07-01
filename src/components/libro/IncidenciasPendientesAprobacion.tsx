'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, Loader2, Bell } from 'lucide-react'
import type { Incidencia } from '@/types/database'

interface Props {
  incidencias: Incidencia[]
  turnoId: string
}

const SEVERIDAD_LABEL: Record<string, string> = {
  bajo:  'Bajo',
  medio: 'Medio',
  alto:  'ALTO',
}

const SEVERIDAD_COLORS: Record<string, string> = {
  bajo:  'bg-gray-100 text-gray-600',
  medio: 'bg-amber-100 text-amber-700',
  alto:  'bg-red-100 text-red-700 font-bold',
}

export default function IncidenciasPendientesAprobacion({ incidencias, turnoId }: Props) {
  const router  = useRouter()
  const [procesando, setProcesando] = useState<string | null>(null)
  const [errores, setErrores]       = useState<Record<string, string>>({})

  if (incidencias.length === 0) return null

  const aprobar = async (incidenciaId: string, decision: 'aprobada' | 'rechazada') => {
    setProcesando(incidenciaId)
    setErrores(prev => ({ ...prev, [incidenciaId]: '' }))
    try {
      const res = await fetch(`/api/incidencias/${incidenciaId}/aprobar`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ decision, turno_id: turnoId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrores(prev => ({ ...prev, [incidenciaId]: data.error ?? 'Error' }))
        return
      }
      router.refresh()
    } catch {
      setErrores(prev => ({ ...prev, [incidenciaId]: 'Error de conexión' }))
    } finally {
      setProcesando(null)
    }
  }

  return (
    <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Bell size={16} className="text-amber-600" />
        <h2 className="text-sm font-bold text-amber-800">
          Incidencias pendientes de aprobación ({incidencias.length})
        </h2>
      </div>

      <div className="space-y-3">
        {incidencias.map((inc) => (
          <div key={inc.id} className="bg-white rounded-xl border border-amber-200 p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-brand-ink">{inc.titulo}</p>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{inc.descripcion}</p>
              </div>
              <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${SEVERIDAD_COLORS[inc.severidad ?? 'bajo']}`}>
                {SEVERIDAD_LABEL[inc.severidad ?? 'bajo']}
              </span>
            </div>

            {errores[inc.id] && (
              <p className="text-xs text-red-600 mb-2">{errores[inc.id]}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => aprobar(inc.id, 'aprobada')}
                disabled={!!procesando}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-50 text-green-700 font-semibold text-xs rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors min-h-[44px]"
              >
                {procesando === inc.id
                  ? <Loader2 size={14} className="animate-spin" />
                  : <CheckCircle2 size={14} />
                }
                Aprobar
              </button>
              <button
                onClick={() => aprobar(inc.id, 'rechazada')}
                disabled={!!procesando}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-50 text-red-600 font-semibold text-xs rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors min-h-[44px]"
              >
                {procesando === inc.id
                  ? <Loader2 size={14} className="animate-spin" />
                  : <XCircle size={14} />
                }
                Rechazar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
