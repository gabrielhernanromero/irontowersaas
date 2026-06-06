'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  ShieldCheck, Users, AlertCircle, Loader2, Trash2,
  RefreshCcw, UserPlus, Calendar,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Tecnico {
  id: string
  nombre: string
  apellido: string
  dni: string | null
}

interface Cliente {
  id: string
  nombre_empresa: string
}

interface EsquemaRow {
  id: string
  nombre: string
  hora_inicio: string
  hora_fin: string
  asignaciones: AsignacionPersistente[]
}

interface AsignacionPersistente {
  id: string
  rol_turno: 'encargado' | 'apoyo'
  usuario: { id: string; nombre: string; apellido: string; dni: string | null } | null
}

interface ExcepcionRow {
  id: string
  esquema_id: string
  rol_turno: 'encargado' | 'apoyo'
  fecha: string
  usuario: { id: string; nombre: string; apellido: string; dni: string | null } | null
}

interface Props {
  tecnicos: Tecnico[]
  clientes: Cliente[]
}

const HOY = new Date().toISOString().split('T')[0]

const fmtT = (t: string) => t.slice(0, 5)

// ─────────────────────────────────────────────────────────────────────────────

export default function AsignacionesTurnoPanel({ tecnicos, clientes }: Props) {
  const [clienteId,   setClienteId]   = useState('')
  const [fecha,       setFecha]       = useState(HOY)
  const [esquemas,    setEsquemas]    = useState<EsquemaRow[]>([])
  const [excepciones, setExcepciones] = useState<ExcepcionRow[]>([])
  const [cargando,    setCargando]    = useState(false)
  const [error,       setError]       = useState('')

  // Estado del picker de override por slot
  const [overrideSlot, setOverrideSlot] = useState<{ esquema_id: string; rol: 'encargado' | 'apoyo' } | null>(null)
  const [overrideTecnico, setOverrideTecnico] = useState('')
  const [guardando,  setGuardando]    = useState(false)

  // Carga esquemas (plantilla) cuando cambia el cliente
  const cargarEsquemas = useCallback(async () => {
    if (!clienteId) return
    setCargando(true); setError('')
    try {
      const res  = await fetch(`/api/supervisor/esquemas-cobertura?cliente_id=${clienteId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setEsquemas(data.esquemas ?? [])
    } catch (e) { setError((e as Error).message) }
    finally     { setCargando(false) }
  }, [clienteId])

  // Carga excepciones cuando cambia cliente o fecha
  const cargarExcepciones = useCallback(async () => {
    if (!clienteId) return
    try {
      const res  = await fetch(`/api/supervisor/asignaciones?cliente_id=${clienteId}&fecha=${fecha}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setExcepciones(Array.isArray(data) ? data : [])
    } catch { /* silencioso */ }
  }, [clienteId, fecha])

  useEffect(() => { cargarEsquemas() },    [cargarEsquemas])
  useEffect(() => { cargarExcepciones() }, [cargarExcepciones])

  // Asignación efectiva para un slot: excepción del día > persistente
  function getEfectiva(esquema_id: string, rol: 'encargado' | 'apoyo') {
    const exc = excepciones.find(e => e.esquema_id === esquema_id && e.rol_turno === rol)
    if (exc) return { ...exc.usuario, tipo: 'excepcion' as const, exc_id: exc.id }
    const base = esquemas.find(e => e.id === esquema_id)
      ?.asignaciones.find(a => a.rol_turno === rol)
    if (base?.usuario) return { ...base.usuario, tipo: 'permanente' as const, exc_id: null }
    return null
  }

  // Crear excepción (override para el día)
  async function crearExcepcion(esquema_id: string) {
    if (!overrideTecnico || !overrideSlot) return
    setGuardando(true); setError('')
    try {
      const res  = await fetch('/api/supervisor/asignaciones', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ esquema_id, usuario_id: overrideTecnico, rol_turno: overrideSlot.rol, fecha }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setExcepciones(prev => [...prev.filter(e => !(e.esquema_id === esquema_id && e.rol_turno === overrideSlot.rol)), data])
      setOverrideSlot(null); setOverrideTecnico('')
    } catch (e) { setError((e as Error).message) }
    finally     { setGuardando(false) }
  }

  // Eliminar excepción (vuelve a permanente)
  async function eliminarExcepcion(exc_id: string) {
    const res = await fetch(`/api/supervisor/asignaciones/${exc_id}`, { method: 'DELETE' })
    if (res.ok) setExcepciones(prev => prev.filter(e => e.id !== exc_id))
    else        setError('Error al eliminar la excepción')
  }

  return (
    <div className="space-y-6">
      {/* ── Filtros ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Seleccionar objetivo y fecha</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Objetivo</label>
            <select
              value={clienteId}
              onChange={e => { setClienteId(e.target.value); setEsquemas([]); setExcepciones([]) }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
            >
              <option value="">Seleccioná un objetivo…</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre_empresa}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
            />
          </div>
        </div>
      </div>

      {!clienteId && (
        <p className="text-center text-gray-400 py-8 text-sm">
          Seleccioná un objetivo para ver los turnos.
        </p>
      )}

      {clienteId && error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {clienteId && cargando && (
        <div className="flex justify-center py-8">
          <Loader2 size={24} className="animate-spin text-gray-300" />
        </div>
      )}

      {clienteId && !cargando && esquemas.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-gray-400 text-sm">
          <Calendar size={28} className="mx-auto mb-2 opacity-30" />
          <p>Este objetivo no tiene esquemas de cobertura configurados.</p>
          <p className="text-xs mt-1">Configurarlos desde la pestaña "Turnos y Personal" del cliente.</p>
        </div>
      )}

      {/* ── Una card por esquema ── */}
      {!cargando && esquemas.map(esquema => {
        const isOverriding = overrideSlot?.esquema_id === esquema.id

        return (
          <div key={esquema.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="bg-gray-50 border-b border-gray-100 px-5 py-3">
              <span className="font-semibold text-sm text-brand-ink">{esquema.nombre}</span>
              <span className="ml-2 text-xs font-mono text-gray-400">
                {fmtT(esquema.hora_inicio)} → {fmtT(esquema.hora_fin)}
              </span>
            </div>

            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(['encargado', 'apoyo'] as const).map(rol => {
                const efectiva = getEfectiva(esquema.id, rol)
                const isOverSlot = isOverriding && overrideSlot?.rol === rol

                return (
                  <div
                    key={rol}
                    className={`rounded-xl border-2 p-4 ${
                      efectiva
                        ? rol === 'encargado'
                          ? 'border-brand-orange/40 bg-brand-orange/5'
                          : 'border-blue-300/60 bg-blue-50/50'
                        : 'border-dashed border-gray-200'
                    }`}
                  >
                    {/* Slot header */}
                    <div className="flex items-center gap-2 mb-2">
                      {rol === 'encargado'
                        ? <ShieldCheck size={14} className="text-brand-orange" />
                        : <Users       size={14} className="text-blue-500"      />
                      }
                      <span className={`text-xs font-bold uppercase tracking-wide ${
                        rol === 'encargado' ? 'text-brand-orange' : 'text-blue-500'
                      }`}>
                        {rol === 'encargado' ? 'Encargado' : 'Apoyo'}
                      </span>
                    </div>

                    {/* Persona efectiva */}
                    {efectiva ? (
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">
                            {efectiva.apellido}, {efectiva.nombre}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-gray-400">DNI {efectiva.dni ?? '—'}</p>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                              efectiva.tipo === 'excepcion'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}>
                              {efectiva.tipo === 'excepcion' ? 'excepción' : 'permanente'}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {efectiva.tipo === 'excepcion' && efectiva.exc_id && (
                            <button
                              onClick={() => eliminarExcepcion(efectiva.exc_id!)}
                              title="Restaurar permanente"
                              className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                            >
                              <RefreshCcw size={13} />
                            </button>
                          )}
                          <button
                            onClick={() => { setOverrideSlot({ esquema_id: esquema.id, rol }); setOverrideTecnico('') }}
                            title="Cambiar para este día"
                            className="p-1.5 text-gray-400 hover:text-brand-ink hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <UserPlus size={13} />
                          </button>
                          {efectiva.tipo === 'excepcion' && efectiva.exc_id && (
                            <button
                              onClick={() => eliminarExcepcion(efectiva.exc_id!)}
                              title="Eliminar excepción"
                              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-400">Sin asignar</p>
                        <button
                          onClick={() => { setOverrideSlot({ esquema_id: esquema.id, rol }); setOverrideTecnico('') }}
                          className="text-xs text-brand-orange font-semibold hover:underline flex items-center gap-1"
                        >
                          <UserPlus size={12} /> Asignar
                        </button>
                      </div>
                    )}

                    {/* Picker de override para este slot */}
                    {isOverSlot && (
                      <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                        <select
                          value={overrideTecnico}
                          onChange={e => setOverrideTecnico(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
                        >
                          <option value="">Seleccioná un técnico…</option>
                          {tecnicos.map(t => (
                            <option key={t.id} value={t.id}>
                              {t.apellido}, {t.nombre}
                            </option>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          <button
                            onClick={() => crearExcepcion(esquema.id)}
                            disabled={!overrideTecnico || guardando}
                            className="flex-1 bg-brand-orange text-white text-xs font-semibold py-2 rounded-lg disabled:opacity-60 flex items-center justify-center gap-1"
                          >
                            {guardando ? <Loader2 size={12} className="animate-spin" /> : 'Confirmar para hoy'}
                          </button>
                          <button
                            onClick={() => { setOverrideSlot(null); setOverrideTecnico('') }}
                            className="text-xs text-gray-500 px-2 py-2 border border-gray-200 rounded-lg"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
