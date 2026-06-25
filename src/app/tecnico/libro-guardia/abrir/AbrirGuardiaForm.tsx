'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, AlertTriangle, Play, User, CreditCard, Clock, Building2, CalendarClock, Ban, Package, CheckCircle2, XCircle, Users, ShieldAlert } from 'lucide-react'
import Link from 'next/link'

function nowTime() { return new Date().toTimeString().slice(0, 5) }
function todayDate() { return new Date().toISOString().split('T')[0] }
function currentTurno(): 'diurno' | 'nocturno' { return new Date().getHours() < 18 ? 'diurno' : 'nocturno' }

function formatHora(h: string) {
  return h.length === 5 ? `${h} hs` : h
}

interface Elemento {
  id: string
  nombre: string
  codigo_patrimonial: string
  categoria: string | null
}

interface VerifState {
  estado: 'ok' | 'falla' | 'faltante' | null
  observacion: string
}

interface PersonalApoyo {
  usuario_id: string
  nombre: string
}

interface Props {
  tecnicoNombre: string
  tecnicoDni: string
  turnoSalienteId?: string
  salienteNombre?: string
  clientes: { id: string; nombre_empresa: string }[]
  defaultClienteId?: string
  clienteIdFijo?: string
  esquema?: { id?: string; nombre: string; hora_inicio: string; hora_fin: string } | null
  turnoConfig?: 'diurno' | 'nocturno' | null
  validacionBloqueada?: boolean
  elementos?: Elemento[]
  personalApoyo?: PersonalApoyo[]
  interino?: boolean
}

export default function AbrirGuardiaForm({
  tecnicoNombre, tecnicoDni, turnoSalienteId, salienteNombre,
  clientes, defaultClienteId, clienteIdFijo,
  esquema, turnoConfig, validacionBloqueada, elementos = [],
  personalApoyo = [], interino = false,
}: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [horario, setHorario]       = useState(nowTime())
  const [turno]                     = useState<'diurno' | 'nocturno'>(turnoConfig ?? currentTurno())
  const [clienteId, setClienteId]   = useState<string>(clienteIdFijo ?? defaultClienteId ?? clientes[0]?.id ?? '')

  // Estado de verificación de elementos: mapa elementoId → { estado, observacion }
  const [verif, setVerif] = useState<Record<string, VerifState>>(() =>
    Object.fromEntries(elementos.map(e => [e.id, { estado: null, observacion: '' }]))
  )

  // Presencia de personal de apoyo: true = presente (default), false = ausente
  const [presencia, setPresencia] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(personalApoyo.map(p => [p.usuario_id, true]))
  )

  const todosVerificados = elementos.length === 0 ||
    elementos.every(e => verif[e.id]?.estado !== null)

  function setEstado(id: string, estado: 'ok' | 'falla' | 'faltante') {
    setVerif(prev => ({ ...prev, [id]: { ...prev[id], estado } }))
  }

  function setObs(id: string, obs: string) {
    setVerif(prev => ({ ...prev, [id]: { ...prev[id], observacion: obs } }))
  }

  async function handleIniciar() {
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/libro-turno/abrir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha:           todayDate(),
          turno,
          tecnico_nombre:  tecnicoNombre,
          tecnico_dni:     tecnicoDni,
          horario_inicio:  horario,
          cliente_id:      clienteId || undefined,
          interino:        interino || undefined,
          turno_saliente_id: turnoSalienteId,
          personal_apoyo: personalApoyo.length > 0
            ? personalApoyo.map(p => ({
                usuario_id: p.usuario_id,
                nombre:     p.nombre,
                presente:   presencia[p.usuario_id] ?? true,
              }))
            : undefined,
          verificacion_elementos: elementos.length > 0
            ? elementos.map(e => ({
                elemento_id:      e.id,
                nombre:           e.nombre,
                estado_operativo: verif[e.id]?.estado ?? 'ok',
                observacion:      verif[e.id]?.observacion || undefined,
              }))
            : undefined,
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
        <div>
          <h1 className="text-xl font-condensed font-bold text-brand-ink">
            {interino ? 'Abrir como encargado interino' : 'Iniciar guardia'}
          </h1>
          {interino && (
            <p className="text-xs text-amber-600 font-medium">El encargado no se presentó</p>
          )}
        </div>
      </div>

      {/* Banner de modo interino */}
      {interino && (
        <div className="flex items-start gap-3 border-2 border-amber-400 bg-amber-50 rounded-xl p-4">
          <ShieldAlert size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Apertura como encargado interino</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Vas a asumir las responsabilidades del encargado de turno.
              Esta situación quedará registrada en el libro de guardia.
            </p>
          </div>
        </div>
      )}

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

      {/* Bloqueo por turno no activo */}
      {validacionBloqueada && (
        <div className="flex items-start gap-3 border-2 border-red-300 bg-red-50 rounded-xl p-4">
          <Ban size={18} className="text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Sin turno activo en este momento</p>
            <p className="text-sm text-red-700 mt-0.5">
              No estás dentro del horario programado. Podés iniciar hasta 30 minutos antes
              del comienzo de tu turno.
            </p>
            <p className="text-xs text-red-600 mt-2">
              Si creés que es un error, contactá al supervisor.
            </p>
          </div>
        </div>
      )}

      {/* Datos del técnico */}
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

      {/* Puesto de trabajo */}
      {clientes.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Puesto de trabajo</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-orange/10 flex items-center justify-center shrink-0">
              <Building2 size={18} className="text-brand-orange" />
            </div>
            {clienteIdFijo ? (
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-3 min-h-[44px] flex items-center">
                <span className="text-base font-medium text-brand-ink">
                  {clientes.find(c => c.id === clienteIdFijo)?.nombre_empresa ?? '—'}
                </span>
              </div>
            ) : (
              <select
                value={clienteId}
                onChange={e => setClienteId(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg p-3 text-base min-h-[44px]"
              >
                <option value="">— Sin asignar —</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre_empresa}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      {/* Turno configurado por supervisor */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Horario de inicio</p>

        {/* Esquema de cobertura */}
        {esquema ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <CalendarClock size={18} className="text-green-700" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-400">Turno configurado</p>
              <p className="font-semibold text-brand-ink">{esquema.nombre}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {formatHora(esquema.hora_inicio)} → {formatHora(esquema.hora_fin)}
                <span className={`ml-2 text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                  turno === 'diurno' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'
                }`}>
                  {turno === 'diurno' ? 'Diurno' : 'Nocturno'}
                </span>
              </p>
            </div>
          </div>
        ) : turnoConfig ? (
          // Solo turno_habitual del perfil, sin esquema
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
              <CalendarClock size={18} className="text-gray-500" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Turno habitual</p>
              <span className={`text-sm font-semibold px-2 py-1 rounded-full ${
                turno === 'diurno' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'
              }`}>
                {turno === 'diurno' ? 'Diurno' : 'Nocturno'}
              </span>
            </div>
          </div>
        ) : (
          // Sin configuración — selector manual
          <div>
            <label className="block text-sm font-medium mb-1">Turno</label>
            <select
              value={turno}
              disabled
              className="w-full border border-gray-300 rounded-lg p-3 text-base min-h-[44px] bg-gray-50 text-gray-500"
            >
              <option value="diurno">Diurno</option>
              <option value="nocturno">Nocturno</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Sin esquema configurado. Contactá al supervisor.
            </p>
          </div>
        )}

        {/* Hora de inicio — siempre editable */}
        <div>
          <label htmlFor="horario" className="block text-sm font-medium mb-1">
            <Clock size={13} className="inline mr-1" />
            Hora de inicio
          </label>
          <input
            id="horario"
            type="time"
            value={horario}
            onChange={e => setHorario(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-3 text-base min-h-[44px]"
          />
        </div>
      </div>

      {/* Personal de apoyo pre-configurado */}
      {!interino && personalApoyo.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-gray-100">
            <Users size={16} className="text-brand-blue" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Personal de apoyo
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {personalApoyo.map(persona => {
              const presente = presencia[persona.usuario_id] ?? true
              return (
                <div
                  key={persona.usuario_id}
                  className={`flex items-center justify-between px-5 py-3.5 gap-3 transition-colors ${!presente ? 'bg-red-50' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                      presente ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      {presente
                        ? <CheckCircle2 size={18} className="text-green-600" />
                        : <XCircle     size={18} className="text-red-500"   />
                      }
                    </div>
                    <div>
                      <p className={`text-sm font-semibold transition-colors ${presente ? 'text-brand-ink' : 'text-red-700'}`}>
                        {persona.nombre}
                      </p>
                      <p className={`text-xs font-medium transition-colors ${presente ? 'text-green-600' : 'text-red-500'}`}>
                        {presente ? 'Presente' : 'Ausente'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPresencia(p => ({ ...p, [persona.usuario_id]: true }))}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border-2 min-h-[44px] min-w-[80px] justify-center transition-all ${
                        presente
                          ? 'bg-green-500 border-green-500 text-white shadow-sm'
                          : 'border-gray-200 text-gray-400 bg-white'
                      }`}
                    >
                      <CheckCircle2 size={14} />
                      Presente
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresencia(p => ({ ...p, [persona.usuario_id]: false }))}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border-2 min-h-[44px] min-w-[80px] justify-center transition-all ${
                        !presente
                          ? 'bg-red-500 border-red-500 text-white shadow-sm'
                          : 'border-gray-200 text-gray-400 bg-white'
                      }`}
                    >
                      <XCircle size={14} />
                      Ausente
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Verificación de elementos del puesto */}
      {elementos.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Package size={16} className="text-brand-orange" />
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Elementos del puesto
              </p>
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              todosVerificados
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {elementos.filter(e => verif[e.id]?.estado !== null).length}/{elementos.length} verificados
            </span>
          </div>

          <div className="divide-y divide-gray-100">
            {elementos.map(el => {
              const v = verif[el.id]
              return (
                <div key={el.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-brand-ink">{el.nombre}</p>
                      <p className="text-xs text-gray-400">{el.codigo_patrimonial}{el.categoria ? ` · ${el.categoria}` : ''}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setEstado(el.id, 'ok')}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors min-h-[36px] ${
                          v?.estado === 'ok'
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-gray-300 text-gray-500 bg-white'
                        }`}
                      >
                        <CheckCircle2 size={14} />
                        OK
                      </button>
                      <button
                        type="button"
                        onClick={() => setEstado(el.id, v?.estado === 'falla' ? 'faltante' : 'falla')}
                        onContextMenu={e => { e.preventDefault(); setEstado(el.id, 'faltante') }}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors min-h-[36px] ${
                          v?.estado === 'falla' || v?.estado === 'faltante'
                            ? 'bg-red-500 border-red-500 text-white'
                            : 'border-gray-300 text-gray-500 bg-white'
                        }`}
                      >
                        <XCircle size={14} />
                        {v?.estado === 'faltante' ? 'Faltante' : 'Novedad'}
                      </button>
                    </div>
                  </div>

                  {(v?.estado === 'falla' || v?.estado === 'faltante') && (
                    <div className="mt-2 flex gap-2">
                      <select
                        value={v.estado}
                        onChange={e => setEstado(el.id, e.target.value as 'falla' | 'faltante')}
                        className="border border-red-300 rounded-lg px-2 py-1.5 text-xs text-red-700 bg-red-50 min-h-[36px]"
                      >
                        <option value="falla">Falla / Daño</option>
                        <option value="faltante">Faltante / Extraviado</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Describí el problema..."
                        value={v.observacion}
                        onChange={e => setObs(el.id, e.target.value)}
                        className="flex-1 border border-red-300 rounded-lg px-3 py-1.5 text-xs min-h-[36px] bg-red-50 text-red-800 placeholder-red-300"
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

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
            disabled={submitting || !tecnicoNombre || !tecnicoDni || validacionBloqueada || !todosVerificados}
            className="w-full flex items-center justify-center gap-2 bg-brand-orange text-white font-bold py-4 rounded-xl text-base min-h-[56px] disabled:opacity-60 active:scale-[0.98] transition-transform"
          >
            {submitting ? 'Iniciando...' : (
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
