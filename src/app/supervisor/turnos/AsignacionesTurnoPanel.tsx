'use client'

import { useState, useEffect } from 'react'
import {
  ShieldCheck, Users, AlertCircle, Loader2, Trash2,
  Plus, UserPlus, UserMinus, Edit2, X, Calendar,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Tecnico {
  id: string
  nombre: string
  apellido: string
  dni: string | null
  activo: boolean
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
  fecha_desde: string | null
  fecha_hasta: string | null
  activo: boolean
  dias_semana: number[]
  asignaciones: {
    id: string
    rol_turno: 'encargado' | 'apoyo'
    usuario: { id: string; nombre: string; apellido: string; dni: string | null } | null
  }[]
}

interface Props {
  tecnicos: Tecnico[]
  clientes: Cliente[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DIAS_LABEL = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá']

function diasLabel(dias: number[]): string {
  const sorted = [...dias].sort()
  if (sorted.length === 7) return 'Todos los días'
  if (sorted.join() === '1,2,3,4,5') return 'Lun – Vie'
  if (sorted.join() === '0,6') return 'Fines de semana'
  if (sorted.join() === '1,2,3,4,5,6') return 'Lun – Sáb'
  return sorted.map(d => DIAS_LABEL[d]).join(', ')
}

const PRESETS_DIAS = [
  { label: 'Todos',         dias: [0,1,2,3,4,5,6] },
  { label: 'Lun–Vie',       dias: [1,2,3,4,5]     },
  { label: 'Fin de semana', dias: [0,6]            },
]

const fmtT = (t: string) => t.slice(0, 5)

// ── HoraSelect ────────────────────────────────────────────────────────────────

function HoraSelect({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <input
      type="time"
      value={value}
      onChange={e => onChange(e.target.value)}
      className={className}
    />
  )
}

// ── DiasSemanaSelector ────────────────────────────────────────────────────────

function DiasSemanaSelector({ value, onChange }: { value: number[]; onChange: (d: number[]) => void }) {
  function toggle(dia: number) {
    if (value.includes(dia)) {
      if (value.length === 1) return
      onChange(value.filter(d => d !== dia))
    } else {
      onChange([...value, dia].sort((a, b) => a - b))
    }
  }
  function isPreset(dias: number[]) {
    return dias.length === value.length && dias.every(d => value.includes(d))
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        {PRESETS_DIAS.map(p => (
          <button key={p.label} type="button" onClick={() => onChange(p.dias)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors border ${
              isPreset(p.dias)
                ? 'bg-brand-orange/10 border-brand-orange text-brand-orange'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex gap-1">
        {DIAS_LABEL.map((label, dia) => (
          <button key={dia} type="button" onClick={() => toggle(dia)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              value.includes(dia)
                ? 'bg-brand-orange text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AsignacionesTurnoPanel({ tecnicos, clientes }: Props) {
  const [clienteId,        setClienteId]        = useState('')
  const [esquemas,         setEsquemas]         = useState<EsquemaRow[]>([])
  const [loading,          setLoading]          = useState(false)
  const [error,            setError]            = useState<string | null>(null)

  // Crear esquema
  const [crearForm,        setCrearForm]        = useState<{
    nombre: string; hora_inicio: string; hora_fin: string
    fecha_desde: string; fecha_hasta: string; dias_semana: number[]
  } | null>(null)
  const [guardandoEsquema, setGuardandoEsquema] = useState(false)
  const [errorEsquema,     setErrorEsquema]     = useState<string | null>(null)

  // Editar esquema
  const [editandoEsquema,  setEditandoEsquema]  = useState<{
    id: string; nombre: string; hora_inicio: string; hora_fin: string
    dias_semana: number[]; fecha_desde: string; fecha_hasta: string
  } | null>(null)
  const [guardandoEdit,    setGuardandoEdit]    = useState(false)

  // Asignaciones
  const [asignandoEn,      setAsignandoEn]      = useState<{ esquema_id: string; rol: 'encargado' | 'apoyo' } | null>(null)
  const [selectedTecnico,  setSelectedTecnico]  = useState('')
  const [guardandoAsig,    setGuardandoAsig]    = useState(false)

  useEffect(() => {
    if (!clienteId) { setEsquemas([]); return }
    setLoading(true); setError(null)
    fetch(`/api/supervisor/esquemas-cobertura?cliente_id=${clienteId}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setEsquemas(d.esquemas ?? []); else setError(d.error) })
      .catch(() => setError('Error al cargar los turnos'))
      .finally(() => setLoading(false))
  }, [clienteId])

  async function crearEsquema() {
    if (!crearForm || !clienteId) return
    setGuardandoEsquema(true); setErrorEsquema(null)
    try {
      const res  = await fetch('/api/supervisor/esquemas-cobertura', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id:  clienteId,
          ...crearForm,
          fecha_desde: crearForm.fecha_desde || new Date().toISOString().slice(0, 10),
          fecha_hasta: crearForm.fecha_hasta || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setEsquemas(prev => [...prev, data.esquema].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio)))
      setCrearForm(null)
    } catch (e) { setErrorEsquema((e as Error).message) }
    finally     { setGuardandoEsquema(false) }
  }

  async function guardarEdicion() {
    if (!editandoEsquema) return
    setGuardandoEdit(true)
    try {
      const { id, ...fields } = editandoEsquema
      const res  = await fetch(`/api/supervisor/esquemas-cobertura/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, fecha_hasta: fields.fecha_hasta || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setEsquemas(prev => prev.map(e => e.id === id ? { ...e, ...data.esquema } : e))
      setEditandoEsquema(null)
    } catch (e) { setError((e as Error).message) }
    finally     { setGuardandoEdit(false) }
  }

  async function eliminarEsquema(id: string, nombre: string) {
    if (!confirm(`¿Eliminar "${nombre}"? Se perderán todas las asignaciones permanentes.`)) return
    const res = await fetch(`/api/supervisor/esquemas-cobertura/${id}`, { method: 'DELETE' })
    if (res.ok) setEsquemas(prev => prev.filter(e => e.id !== id))
    else        setError('Error al eliminar el turno')
  }

  async function asignarPersistente(esquema_id: string) {
    if (!selectedTecnico || !asignandoEn) return
    setGuardandoAsig(true); setError(null)
    try {
      const res  = await fetch('/api/supervisor/asignaciones-persistentes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ esquema_id, usuario_id: selectedTecnico, rol_turno: asignandoEn.rol }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setEsquemas(prev => prev.map(e => e.id === esquema_id
        ? { ...e, asignaciones: [...e.asignaciones, data.asignacion] } : e
      ))
      setAsignandoEn(null); setSelectedTecnico('')
    } catch (e) { setError((e as Error).message) }
    finally     { setGuardandoAsig(false) }
  }

  async function quitarAsignacion(esquema_id: string, asignacion_id: string) {
    const res = await fetch(`/api/supervisor/asignaciones-persistentes?id=${asignacion_id}`, { method: 'DELETE' })
    if (res.ok) {
      setEsquemas(prev => prev.map(e => e.id === esquema_id
        ? { ...e, asignaciones: e.asignaciones.filter(a => a.id !== asignacion_id) } : e
      ))
    } else { setError('Error al quitar la asignación') }
  }

  function tecDisponibles(esquema: EsquemaRow) {
    const asignadosIds = new Set(esquema.asignaciones.map(a => a.usuario?.id).filter(Boolean))
    return tecnicos.filter(t => t.activo && !asignadosIds.has(t.id))
  }

  return (
    <div className="space-y-6">
      {/* ── Selector de objetivo ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Seleccionar objetivo</h2>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Objetivo</label>
          <select
            value={clienteId}
            onChange={e => {
              setClienteId(e.target.value)
              setEsquemas([])
              setError(null)
              setCrearForm(null)
              setEditandoEsquema(null)
              setAsignandoEn(null)
            }}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
          >
            <option value="">Seleccioná un objetivo…</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre_empresa}</option>)}
          </select>
        </div>
      </div>

      {!clienteId && (
        <p className="text-center text-gray-400 py-8 text-sm">
          Seleccioná un objetivo para configurar sus turnos de guardia.
        </p>
      )}

      {clienteId && error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
          <AlertCircle size={15} /> {error}
          <button className="ml-auto" onClick={() => setError(null)}><X size={13} /></button>
        </div>
      )}

      {clienteId && loading && (
        <div className="flex justify-center py-8">
          <Loader2 size={24} className="animate-spin text-gray-300" />
        </div>
      )}

      {/* ── Lista de esquemas ── */}
      {clienteId && !loading && (
        <div className="space-y-4">
          {esquemas.map(esquema => {
            const encargado   = esquema.asignaciones.find(a => a.rol_turno === 'encargado')
            const apoyos      = esquema.asignaciones.filter(a => a.rol_turno === 'apoyo')
            const isEditing   = editandoEsquema?.id === esquema.id
            const isAsig      = asignandoEn?.esquema_id === esquema.id
            const disponibles = tecDisponibles(esquema)

            return (
              <div key={esquema.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                {/* Cabecera del esquema */}
                <div className="bg-gray-50 border-b border-gray-100 px-4 py-3">
                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        value={editandoEsquema.nombre}
                        onChange={e => setEditandoEsquema(p => p ? { ...p, nombre: e.target.value } : p)}
                        className="w-full text-sm font-semibold border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
                        placeholder="Nombre del turno"
                      />
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <label className="text-xs text-gray-400 mb-1 block">Entrada</label>
                            <HoraSelect value={editandoEsquema.hora_inicio}
                              onChange={v => setEditandoEsquema(p => p ? { ...p, hora_inicio: v } : p)}
                              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30" />
                          </div>
                          <span className="text-gray-400 pt-5">→</span>
                          <div className="flex-1">
                            <label className="text-xs text-gray-400 mb-1 block">Salida</label>
                            <HoraSelect value={editandoEsquema.hora_fin}
                              onChange={v => setEditandoEsquema(p => p ? { ...p, hora_fin: v } : p)}
                              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30" />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 mb-1.5 block">Días</label>
                          <DiasSemanaSelector
                            value={editandoEsquema.dias_semana}
                            onChange={v => setEditandoEsquema(p => p ? { ...p, dias_semana: v } : p)}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <label className="text-xs text-gray-400 mb-1 block">Desde</label>
                            <input type="date" value={editandoEsquema.fecha_desde}
                              onChange={e => setEditandoEsquema(p => p ? { ...p, fecha_desde: e.target.value } : p)}
                              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30" />
                          </div>
                          <span className="text-gray-400 pt-5">→</span>
                          <div className="flex-1">
                            <label className="text-xs text-gray-400 mb-1 block">Hasta <span className="text-gray-300">(opc.)</span></label>
                            <input type="date" value={editandoEsquema.fecha_hasta}
                              onChange={e => setEditandoEsquema(p => p ? { ...p, fecha_hasta: e.target.value } : p)}
                              min={editandoEsquema.fecha_desde}
                              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30" />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={guardarEdicion} disabled={guardandoEdit}
                            className="bg-brand-orange text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60 flex items-center gap-1">
                            {guardandoEdit ? <Loader2 size={12} className="animate-spin" /> : 'Guardar'}
                          </button>
                          <button onClick={() => setEditandoEsquema(null)}
                            className="text-xs text-gray-500 px-2 py-1.5 border border-gray-200 rounded-lg">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="font-semibold text-sm text-brand-ink">{esquema.nombre}</span>
                        <span className="ml-2 text-xs text-gray-400 font-mono">
                          {fmtT(esquema.hora_inicio)} → {fmtT(esquema.hora_fin)}
                        </span>
                        <span className="ml-2 text-xs text-brand-orange font-medium">
                          {diasLabel(esquema.dias_semana ?? [0,1,2,3,4,5,6])}
                        </span>
                        {esquema.fecha_desde && (
                          <span className="ml-2 text-xs text-gray-400">
                            · {new Date(esquema.fecha_desde + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            {esquema.fecha_hasta
                              ? ` → ${new Date(esquema.fecha_hasta + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
                              : ' → permanente'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditandoEsquema({
                            id: esquema.id,
                            nombre: esquema.nombre,
                            hora_inicio: fmtT(esquema.hora_inicio),
                            hora_fin: fmtT(esquema.hora_fin),
                            dias_semana: esquema.dias_semana ?? [0,1,2,3,4,5,6],
                            fecha_desde: esquema.fecha_desde ?? '',
                            fecha_hasta: esquema.fecha_hasta ?? '',
                          })}
                          className="p-1.5 text-gray-400 hover:text-brand-ink hover:bg-gray-100 rounded-lg transition-colors">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => eliminarEsquema(esquema.id, esquema.nombre)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Slot encargado */}
                <div className="px-4 pt-3 pb-1">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-brand-orange uppercase tracking-wide mb-2">
                    <ShieldCheck size={12} /> Encargado
                  </p>
                  {encargado?.usuario ? (
                    <div className="flex items-center justify-between py-1">
                      <div>
                        <span className="text-sm font-medium text-brand-ink">
                          {encargado.usuario.apellido}, {encargado.usuario.nombre}
                        </span>
                        <span className="ml-2 text-xs text-gray-400">DNI {encargado.usuario.dni ?? '—'}</span>
                      </div>
                      <button onClick={() => quitarAsignacion(esquema.id, encargado.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <UserMinus size={13} />
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic py-1">Sin encargado asignado</p>
                  )}
                </div>

                {/* Slots apoyo */}
                <div className="px-4 pt-1 pb-2 border-b border-gray-50">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-blue-500 uppercase tracking-wide mb-2">
                    <Users size={12} /> Apoyo
                  </p>
                  {apoyos.length === 0 && (
                    <p className="text-sm text-gray-400 italic py-1">Sin apoyo asignado</p>
                  )}
                  {apoyos.map(ap => ap.usuario && (
                    <div key={ap.id} className="flex items-center justify-between py-1">
                      <div>
                        <span className="text-sm font-medium text-brand-ink">
                          {ap.usuario.apellido}, {ap.usuario.nombre}
                        </span>
                        <span className="ml-2 text-xs text-gray-400">DNI {ap.usuario.dni ?? '—'}</span>
                      </div>
                      <button onClick={() => quitarAsignacion(esquema.id, ap.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <UserMinus size={13} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Asignar técnico */}
                {isAsig ? (
                  <div className="px-4 py-3 flex items-center gap-2">
                    <select value={selectedTecnico} onChange={e => setSelectedTecnico(e.target.value)}
                      className="flex-1 border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30">
                      <option value="">Seleccioná un técnico…</option>
                      {disponibles.map(t => (
                        <option key={t.id} value={t.id}>{t.apellido}, {t.nombre}</option>
                      ))}
                    </select>
                    <button onClick={() => asignarPersistente(esquema.id)} disabled={!selectedTecnico || guardandoAsig}
                      className="bg-brand-orange text-white text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-60 flex items-center gap-1">
                      {guardandoAsig ? <Loader2 size={12} className="animate-spin" /> : 'Asignar'}
                    </button>
                    <button onClick={() => { setAsignandoEn(null); setSelectedTecnico('') }}
                      className="text-xs text-gray-500 px-2 py-2 border border-gray-200 rounded-lg">×</button>
                  </div>
                ) : (
                  <div className="px-4 py-2.5 flex gap-3">
                    {!encargado && (
                      <button
                        onClick={() => { setAsignandoEn({ esquema_id: esquema.id, rol: 'encargado' }); setSelectedTecnico('') }}
                        className="flex items-center gap-1 text-xs text-brand-orange font-semibold hover:underline">
                        <UserPlus size={12} /> Encargado
                      </button>
                    )}
                    <button
                      onClick={() => { setAsignandoEn({ esquema_id: esquema.id, rol: 'apoyo' }); setSelectedTecnico('') }}
                      className="flex items-center gap-1 text-xs text-blue-600 font-semibold hover:underline">
                      <UserPlus size={12} /> Apoyo
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {/* Crear nuevo esquema */}
          {crearForm ? (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-4">
              <p className="text-sm font-semibold text-brand-ink">Nuevo turno de guardia</p>

              <div>
                <label className="text-xs text-gray-500 mb-1 block font-medium">Nombre del turno</label>
                <input
                  value={crearForm.nombre}
                  onChange={e => setCrearForm(p => p ? { ...p, nombre: e.target.value } : p)}
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
                  placeholder="Ej: Turno Mañana, Guardia Nocturna, 24 hs…"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1.5 block font-medium">Horario</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-400 mb-1 block">Entrada</label>
                    <HoraSelect value={crearForm.hora_inicio}
                      onChange={v => setCrearForm(p => p ? { ...p, hora_inicio: v } : p)}
                      className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30" />
                  </div>
                  <span className="text-gray-400 pt-5">→</span>
                  <div className="flex-1">
                    <label className="text-xs text-gray-400 mb-1 block">Salida</label>
                    <HoraSelect value={crearForm.hora_fin}
                      onChange={v => setCrearForm(p => p ? { ...p, hora_fin: v } : p)}
                      className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30" />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1.5 block font-medium">Días de la semana</label>
                <DiasSemanaSelector
                  value={crearForm.dias_semana}
                  onChange={v => setCrearForm(p => p ? { ...p, dias_semana: v } : p)}
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1.5 block font-medium">Vigencia</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-400 mb-1 block">Desde</label>
                    <input type="date" value={crearForm.fecha_desde}
                      onChange={e => setCrearForm(p => p ? { ...p, fecha_desde: e.target.value } : p)}
                      className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30" />
                  </div>
                  <span className="text-gray-400 pt-5">→</span>
                  <div className="flex-1">
                    <label className="text-xs text-gray-400 mb-1 block">Hasta <span className="font-normal text-gray-400">(opcional)</span></label>
                    <input type="date" value={crearForm.fecha_hasta}
                      onChange={e => setCrearForm(p => p ? { ...p, fecha_hasta: e.target.value } : p)}
                      min={crearForm.fecha_desde}
                      className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30" />
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">Sin fecha de fin = turno permanente</p>
              </div>

              {errorEsquema && <p className="text-red-600 text-xs">{errorEsquema}</p>}
              <div className="flex gap-2">
                <button onClick={crearEsquema} disabled={guardandoEsquema || !crearForm.nombre.trim()}
                  className="bg-brand-orange text-white text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-60">
                  {guardandoEsquema ? 'Creando...' : 'Crear turno'}
                </button>
                <button onClick={() => { setCrearForm(null); setErrorEsquema(null) }}
                  className="text-xs text-gray-500 px-3 py-2 border border-gray-200 rounded-lg">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCrearForm({ nombre: '', hora_inicio: '08:00', hora_fin: '20:00', fecha_desde: new Date().toISOString().slice(0, 10), fecha_hasta: '', dias_semana: [0,1,2,3,4,5,6] })}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-brand-orange/40 hover:text-brand-orange transition-colors">
              <Plus size={16} /> Agregar bloque horario
            </button>
          )}

          {esquemas.length === 0 && !crearForm && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-gray-400 text-sm">
              <Calendar size={28} className="mx-auto mb-2 opacity-30" />
              <p>Este objetivo no tiene turnos configurados todavía.</p>
              <p className="text-xs mt-1">Usá el botón de abajo para agregar el primer bloque horario.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
