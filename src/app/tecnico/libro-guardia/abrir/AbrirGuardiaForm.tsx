'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, AlertTriangle, Play, User, CreditCard, Clock, Building2 } from 'lucide-react'
import Link from 'next/link'

function nowTime() { return new Date().toTimeString().slice(0, 5) }
function todayDate() { return new Date().toISOString().split('T')[0] }
function currentTurno(): 'diurno' | 'nocturno' { return new Date().getHours() < 18 ? 'diurno' : 'nocturno' }

interface Props {
  tecnicoNombre: string
  tecnicoDni: string
  turnoSalienteId?: string
  salienteNombre?: string
  clientes: { id: string; nombre_empresa: string }[]
  defaultClienteId?: string
}

export default function AbrirGuardiaForm({ tecnicoNombre, tecnicoDni, turnoSalienteId, salienteNombre, clientes, defaultClienteId }: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [horario, setHorario] = useState(nowTime())
  const [turno, setTurno] = useState<'diurno' | 'nocturno'>(currentTurno())
  const [clienteId, setClienteId] = useState<string>(defaultClienteId ?? clientes[0]?.id ?? '')

  async function handleIniciar() {
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/libro-turno/abrir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: todayDate(),
          turno,
          tecnico_nombre: tecnicoNombre,
          tecnico_dni: tecnicoDni,
          horario_inicio: horario,
          cliente_id: clienteId || undefined,
          turno_saliente_id: turnoSalienteId,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al abrir la guardia'); return }
      router.push('/tecnico/libro-guardia?ok=1')
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-28">
      <div className="flex items-center gap-3">
        <Link href="/tecnico/libro-guardia" className="p-2 -ml-2 text-gray-500 min-h-[44px] flex items-center">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-condensed font-bold text-brand-ink">Iniciar guardia</h1>
      </div>

      {/* Relevo pendiente */}
      {turnoSalienteId && salienteNombre && (
        <div className="flex items-start gap-3 border-2 border-amber-300 bg-amber-50 rounded-xl p-4">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            Vas a tomar el relevo de <strong>{salienteNombre}</strong>.
            Al iniciar tu guardia, el turno anterior quedará cerrado.
          </p>
        </div>
      )}

      {/* Tarjeta de confirmación — datos del técnico */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Tu guardia</p>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-blue/10 flex items-center justify-center shrink-0">
            <User size={18} className="text-brand-blue" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Técnico</p>
            <p className="font-semibold text-brand-ink">{tecnicoNombre || '—'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-blue/10 flex items-center justify-center shrink-0">
            <CreditCard size={18} className="text-brand-blue" />
          </div>
          <div>
            <p className="text-xs text-gray-400">DNI</p>
            <p className="font-semibold text-brand-ink">{tecnicoDni || '—'}</p>
          </div>
        </div>

        {(!tecnicoNombre || !tecnicoDni) && (
          <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
            Tu perfil no tiene nombre o DNI completo. Contactá al administrador.
          </p>
        )}
      </div>

      {/* Selector de puesto / cliente */}
      {clientes.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Puesto de trabajo</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-orange/10 flex items-center justify-center shrink-0">
              <Building2 size={18} className="text-brand-orange" />
            </div>
            <select
              id="cliente"
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg p-3 text-base min-h-[44px]"
            >
              <option value="">— Sin asignar —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre_empresa}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Ajuste de horario y turno */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Horario de inicio</p>

        <div className="flex gap-4">
          <div className="flex-1">
            <label htmlFor="turno" className="block text-sm font-medium mb-1">Turno</label>
            <select
              id="turno"
              value={turno}
              onChange={(e) => setTurno(e.target.value as 'diurno' | 'nocturno')}
              className="w-full border border-gray-300 rounded-lg p-3 text-base min-h-[44px]"
            >
              <option value="diurno">Diurno</option>
              <option value="nocturno">Nocturno</option>
            </select>
          </div>

          <div className="flex-1">
            <label htmlFor="horario" className="block text-sm font-medium mb-1">
              <Clock size={13} className="inline mr-1" />
              Hora
            </label>
            <input
              id="horario"
              type="time"
              value={horario}
              onChange={(e) => setHorario(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 text-base min-h-[44px]"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Botón sticky */}
      <div className="fixed bottom-16 left-0 right-0 z-50 bg-white border-t border-gray-200 p-3">
        <div className="max-w-[430px] mx-auto">
          <button
            type="button"
            onClick={handleIniciar}
            disabled={submitting || !tecnicoNombre || !tecnicoDni}
            className="w-full flex items-center justify-center gap-2 bg-brand-orange text-white font-bold py-4 rounded-xl text-base min-h-[56px] disabled:opacity-60 active:scale-[0.98] transition-transform"
          >
            {submitting ? (
              'Iniciando...'
            ) : (
              <>
                <Play size={20} />
                Iniciar guardia
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
