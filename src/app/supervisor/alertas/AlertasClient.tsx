'use client'

import { useState } from 'react'
import { AlertTriangle, Bell, CheckCircle2, Clock } from 'lucide-react'
import type { Alerta } from '@/types/database'
import EmptyState from '@/components/ui/EmptyState'

interface Props {
  initialAlertas: Alerta[]
}

function formatRelativo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min  = Math.floor(diff / 60000)
  if (min < 1)   return 'hace un momento'
  if (min < 60)  return `hace ${min} min`
  const hs = Math.floor(min / 60)
  if (hs < 24)   return `hace ${hs} h`
  return new Date(dateStr).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// ── Tarjeta de alerta genérica (sin resolución) ──────────────────────────────

function AlertaCard({ alerta, onRead }: { alerta: Alerta; onRead: (id: string) => void }) {
  const [marking, setMarking] = useState(false)

  async function handleRead() {
    setMarking(true)
    await fetch(`/api/alertas/${alerta.id}/read`, { method: 'PATCH' })
    onRead(alerta.id)
    setMarking(false)
  }

  return (
    <div className={`rounded-xl border p-4 flex justify-between items-start gap-4 ${
      alerta.leida
        ? 'bg-white border-gray-100'
        : 'bg-red-50 border-red-200'
    }`}>
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <Bell size={16} className={`shrink-0 mt-0.5 ${alerta.leida ? 'text-gray-400' : 'text-red-500'}`} />
        <div className="min-w-0">
          <p className={`text-sm leading-snug ${alerta.leida ? 'text-gray-600' : 'text-red-800'}`}>
            {alerta.mensaje}
          </p>
          <p className="text-xs text-gray-400 mt-1">{formatRelativo(alerta.created_at)}</p>
        </div>
      </div>
      {!alerta.leida && (
        <button
          onClick={handleRead}
          disabled={marking}
          className="shrink-0 text-xs bg-white border border-red-300 text-red-700 px-3 py-2 rounded-lg min-h-[36px] hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          {marking ? '...' : 'Leída'}
        </button>
      )}
    </div>
  )
}

// ── Tarjeta de ronda vencida con flujo de resolución ─────────────────────────

function RondaVencidaCard({
  alerta,
  onResolved,
}: {
  alerta: Alerta
  onResolved: (id: string, obs: string, resueltaEn: string) => void
}) {
  const [expandido, setExpandido]     = useState(false)
  const [observacion, setObservacion] = useState('')
  const [enviando, setEnviando]       = useState(false)
  const [error, setError]             = useState<string | null>(null)

  async function handleResolver() {
    if (observacion.trim().length < 10) {
      setError('Describí la resolución (mínimo 10 caracteres)')
      return
    }
    setError(null)
    setEnviando(true)
    const res = await fetch(`/api/alertas/${alerta.id}/resolver`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ observacion: observacion.trim() }),
    })
    if (res.ok) {
      onResolved(alerta.id, observacion.trim(), new Date().toISOString())
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Error al resolver la alerta')
    }
    setEnviando(false)
  }

  // ── Resuelta ──────────────────────────────────────────────────────────────
  if (alerta.resuelta) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-0.5">
              Resuelta
            </p>
            <p className="text-sm text-gray-700 leading-snug">{alerta.mensaje}</p>
            {alerta.resolucion_observacion && (
              <p className="mt-2 text-sm text-gray-600 bg-white border border-emerald-100 rounded-lg px-3 py-2">
                "{alerta.resolucion_observacion}"
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {alerta.resuelta_en ? formatRelativo(alerta.resuelta_en) : formatRelativo(alerta.created_at)}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Pendiente de resolución ───────────────────────────────────────────────
  return (
    <div className="rounded-xl border-2 border-red-400 bg-red-50 overflow-hidden">
      {/* Cabecera */}
      <div className="px-4 pt-4 pb-3 flex items-start gap-3">
        <div className="relative shrink-0 mt-0.5">
          <AlertTriangle size={18} className="text-red-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-red-700 uppercase tracking-wide leading-none mb-1">
            Ronda vencida — acción requerida
          </p>
          <p className="text-sm font-medium text-red-900 leading-snug">
            {alerta.mensaje}
          </p>
          <div className="flex items-center gap-1 text-xs text-red-500 mt-1">
            <Clock size={11} />
            {formatRelativo(alerta.created_at)}
          </div>
        </div>
      </div>

      {/* Formulario de resolución */}
      {!expandido ? (
        <div className="px-4 pb-4">
          <button
            onClick={() => setExpandido(true)}
            className="w-full bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-2.5 px-4 rounded-xl transition-colors min-h-[44px]"
          >
            Registrar resolución
          </button>
        </div>
      ) : (
        <div className="border-t border-red-200 bg-white px-4 py-4 flex flex-col gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              ¿Cómo se resolvió la situación? <span className="text-red-500">*</span>
            </label>
            <textarea
              value={observacion}
              onChange={e => { setObservacion(e.target.value); setError(null) }}
              placeholder="Ej: Me comuniqué con el técnico. Reportó que el acceso al sector estaba bloqueado temporalmente. Ronda reprogramada."
              rows={4}
              className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2.5 bg-white text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setExpandido(false); setError(null) }}
              disabled={enviando}
              className="flex-1 text-sm text-gray-600 border border-gray-300 rounded-xl py-2.5 hover:bg-gray-50 transition-colors min-h-[44px] disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleResolver}
              disabled={enviando || observacion.trim().length < 10}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-bold rounded-xl py-2.5 transition-colors min-h-[44px]"
            >
              {enviando ? 'Guardando...' : 'Confirmar resolución'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function AlertasClient({ initialAlertas }: Props) {
  const [alertas, setAlertas] = useState<Alerta[]>(initialAlertas)

  function handleRead(id: string) {
    setAlertas(prev => prev.map(a => a.id === id ? { ...a, leida: true } : a))
  }

  function handleResolved(id: string, obs: string, resueltaEn: string) {
    setAlertas(prev => prev.map(a =>
      a.id === id
        ? { ...a, resuelta: true, resolucion_observacion: obs, resuelta_en: resueltaEn, leida: true }
        : a
    ))
  }

  const rondaVencidaPendientes = alertas.filter(a => a.tipo === 'ronda_vencida' && !a.resuelta)
  const rondaVencidaResueltas  = alertas.filter(a => a.tipo === 'ronda_vencida' && a.resuelta)
  const otrasNoLeidas          = alertas.filter(a => a.tipo !== 'ronda_vencida' && !a.leida)
  const otrasLeidas            = alertas.filter(a => a.tipo !== 'ronda_vencida' && a.leida)

  const hayPendientes = rondaVencidaPendientes.length > 0 || otrasNoLeidas.length > 0

  if (alertas.length === 0) {
    return (
      <EmptyState
        icon={<Bell size={28} />}
        title="Sin alertas"
        description="Vas a ver aquí las alertas de los técnicos cuando envíen novedades urgentes o se venzan rondas."
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {!hayPendientes && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-700 font-medium">
          <CheckCircle2 size={15} className="shrink-0" />
          Todas las alertas están atendidas
        </div>
      )}

      {/* Rondas vencidas pendientes de resolución — máxima prioridad */}
      {rondaVencidaPendientes.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-red-700 mb-3 uppercase tracking-wide flex items-center gap-2">
            <AlertTriangle size={14} />
            Rondas vencidas ({rondaVencidaPendientes.length})
          </h2>
          <div className="flex flex-col gap-3">
            {rondaVencidaPendientes.map(a => (
              <RondaVencidaCard key={a.id} alerta={a} onResolved={handleResolved} />
            ))}
          </div>
        </section>
      )}

      {/* Otras alertas sin leer */}
      {otrasNoLeidas.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-red-700 mb-3 uppercase tracking-wide">
            Sin leer ({otrasNoLeidas.length})
          </h2>
          <div className="flex flex-col gap-2">
            {otrasNoLeidas.map(a => (
              <AlertaCard key={a.id} alerta={a} onRead={handleRead} />
            ))}
          </div>
        </section>
      )}

      {/* Rondas vencidas ya resueltas */}
      {rondaVencidaResueltas.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide">
            Rondas resueltas
          </h2>
          <div className="flex flex-col gap-2">
            {rondaVencidaResueltas.map(a => (
              <RondaVencidaCard key={a.id} alerta={a} onResolved={handleResolved} />
            ))}
          </div>
        </section>
      )}

      {/* Otras alertas leídas */}
      {otrasLeidas.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide">
            Leídas
          </h2>
          <div className="flex flex-col gap-2">
            {otrasLeidas.map(a => (
              <AlertaCard key={a.id} alerta={a} onRead={handleRead} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
