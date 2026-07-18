'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  History, Settings, Plus, X, Loader2, Edit2, Trash2, Unlock, Copy,
} from 'lucide-react'
import PlanoPlantaCard from '@/components/supervisor/PlanoPlantaCard'
import PlanillaItemsGrid, { CAMPOS_LEGACY } from '@/components/supervisor/PlanillaItemsGrid'
import PlanillaDuplicarModal from '@/components/supervisor/PlanillaDuplicarModal'
import type { PlanillaTipo } from '@/types/database'

type Tab = 'historial' | 'configuracion'

interface PlanillaRow {
  id: string
  tipo: string
  fecha: string
  turno: string
  inmutable: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  users?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientes?: any
}

interface Props {
  planillas: PlanillaRow[]
  searchParams: { tipo?: string; fecha?: string }
  clientes: { id: string; nombre_empresa: string }[]
}

export default function PlanillasSupervisorClient({ planillas, searchParams, clientes }: Props) {
  const [tab, setTab] = useState<Tab>('historial')

  return (
    <div>
      <h1 className="text-2xl font-condensed font-bold text-brand-ink mb-4">Planillas</h1>

      <div className="flex gap-0 border-b border-gray-200 mb-6">
        {(['historial', 'configuracion'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors min-h-[44px] ${
              tab === t
                ? 'border-brand-orange text-brand-orange'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'historial' ? <History size={14} /> : <Settings size={14} />}
            {t === 'historial' ? 'Historial' : 'Configuración'}
          </button>
        ))}
      </div>

      {tab === 'historial' ? (
        <HistorialTab planillas={planillas} searchParams={searchParams} />
      ) : (
        <ConfiguracionTab clientes={clientes} />
      )}
    </div>
  )
}

// ── Historial (sin cambios de comportamiento respecto a la pantalla anterior) ──

function HistorialTab({ planillas, searchParams }: { planillas: PlanillaRow[]; searchParams: { tipo?: string; fecha?: string } }) {
  return (
    <div>
      <form className="flex gap-3 mb-6 flex-wrap">
        <select
          name="tipo"
          defaultValue={searchParams.tipo ?? ''}
          className="border border-gray-300 rounded p-2 text-sm min-h-[44px]"
        >
          <option value="">Todos los tipos</option>
          <option value="hidrantes">Hidrantes</option>
          <option value="extintores">Extintores</option>
        </select>
        <input
          type="date"
          name="fecha"
          defaultValue={searchParams.fecha ?? ''}
          className="border border-gray-300 rounded p-2 text-sm min-h-[44px]"
        />
        <button
          type="submit"
          className="bg-brand-blue text-white px-4 py-2 rounded text-sm min-h-[44px]"
        >
          Filtrar
        </button>
      </form>

      {!planillas?.length && (
        <p className="text-gray-500 text-sm">No hay planillas con esos filtros.</p>
      )}

      <div className="flex flex-col gap-2">
        {planillas?.map((p) => (
          <Link
            key={p.id}
            href={`/supervisor/planillas/${p.id}`}
            className="bg-white border border-gray-100 rounded-xl p-4 flex justify-between items-center hover:bg-gray-50"
          >
            <div>
              <p className="font-medium text-brand-ink capitalize">{p.tipo}</p>
              <p className="text-sm text-gray-500">
                {p.clientes?.nombre_empresa} ·{' '}
                {p.users?.nombre} {p.users?.apellido}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">{p.fecha}</p>
              <p className="text-xs text-gray-400 capitalize">{p.turno}</p>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  p.inmutable
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}
              >
                {p.inmutable ? 'Enviada' : 'Borrador'}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── Configuración: catálogo tipo Excel + tipos de planilla libres ─────────────

function ConfiguracionTab({ clientes }: { clientes: { id: string; nombre_empresa: string }[] }) {
  const [clienteId, setClienteId] = useState<string>(clientes[0]?.id ?? '')
  const [tipos, setTipos] = useState<PlanillaTipo[]>([])
  const [loadingTipos, setLoadingTipos] = useState(true)
  const [tipoId, setTipoId] = useState<string | null>(null)
  const [showNuevoTipo, setShowNuevoTipo] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingTipoId, setEditingTipoId] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [activandoId, setActivandoId] = useState<string | null>(null)
  const [duplicandoTipo, setDuplicandoTipo] = useState<PlanillaTipo | null>(null)

  useEffect(() => {
    if (!clienteId) return
    setLoadingTipos(true)
    setTipoId(null)
    fetch(`/api/supervisor/planilla-tipos?cliente_id=${clienteId}`)
      .then(r => r.json())
      .then(j => {
        const list: PlanillaTipo[] = j.tipos ?? []
        setTipos(list)
        setTipoId(list[0]?.id ?? null)
        setLoadingTipos(false)
      })
      .catch(() => setLoadingTipos(false))
  }, [clienteId])

  async function crearTipo() {
    if (!nuevoNombre.trim()) return
    setCreando(true)
    setError(null)
    try {
      const res = await fetch('/api/supervisor/planilla-tipos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente_id: clienteId, nombre: nuevoNombre.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al crear el tipo'); return }
      setTipos(prev => [...prev, json.tipo])
      setTipoId(json.tipo.id)
      setNuevoNombre('')
      setShowNuevoTipo(false)
    } catch { setError('Error de conexión') }
    finally { setCreando(false) }
  }

  function iniciarRenombre(t: PlanillaTipo) {
    setEditingTipoId(t.id)
    setEditNombre(t.nombre)
  }

  async function guardarRenombre(t: PlanillaTipo) {
    const nombre = editNombre.trim()
    setEditingTipoId(null)
    if (!nombre || nombre === t.nombre) return
    setError(null)
    const res = await fetch('/api/supervisor/planilla-tipos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id, nombre }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Error al renombrar'); return }
    setTipos(prev => prev.map(x => x.id === t.id ? json.tipo : x))
  }

  async function activarMotorGenerico(t: PlanillaTipo) {
    if (!confirm(
      `Las planillas de "${t.nombre}" que se envíen de acá en adelante van a usar esta estructura configurable (podés agregar/quitar/renombrar columnas). Las ya enviadas no cambian y siguen viéndose igual. ¿Activar?`
    )) return
    setActivandoId(t.id)
    setError(null)
    try {
      const camposIniciales = CAMPOS_LEGACY[t.slug] ?? []
      for (let i = 0; i < camposIniciales.length; i++) {
        const res = await fetch('/api/supervisor/planilla-tipo-campos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planilla_tipo_id: t.id, etiqueta: camposIniciales[i].etiqueta, orden: i }),
        })
        if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? 'Error al crear las columnas iniciales') }
      }
      const res = await fetch('/api/supervisor/planilla-tipos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: t.id, usa_motor_generico: true }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al activar')
      setTipos(prev => prev.map(x => x.id === t.id ? json.tipo : x))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión')
    } finally {
      setActivandoId(null)
    }
  }

  async function eliminarTipo(t: PlanillaTipo) {
    if (!confirm(`¿Eliminar la planilla "${t.nombre}"? Se van a borrar sus columnas e ítems configurados. Las planillas ya enviadas de este tipo no se ven afectadas.`)) return
    setError(null)
    const res = await fetch(`/api/supervisor/planilla-tipos?id=${t.id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Error al eliminar'); return }
    setTipos(prev => {
      const next = prev.filter(x => x.id !== t.id)
      if (tipoId === t.id) setTipoId(next[0]?.id ?? null)
      return next
    })
  }

  const tipoActivo = tipos.find(t => t.id === tipoId) ?? null

  return (
    <div>
      {clientes.length > 1 && (
        <div className="mb-5">
          <label className="text-xs font-medium text-gray-600 mb-1 block">Cliente</label>
          <select
            value={clienteId}
            onChange={e => setClienteId(e.target.value)}
            className="w-full sm:w-80 border border-gray-300 rounded-lg p-2.5 text-sm min-h-[44px]"
          >
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre_empresa}</option>)}
          </select>
        </div>
      )}

      {!clienteId ? (
        <p className="text-sm text-gray-400 italic">No hay clientes activos.</p>
      ) : loadingTipos ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-gray-300" />
        </div>
      ) : (
        <>
          {/* Chips de tipos */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            {tipos.map(t => (
              editingTipoId === t.id ? (
                <input
                  key={t.id}
                  autoFocus
                  value={editNombre}
                  onChange={e => setEditNombre(e.target.value)}
                  onBlur={() => guardarRenombre(t)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') guardarRenombre(t)
                    if (e.key === 'Escape') setEditingTipoId(null)
                  }}
                  className="border border-brand-orange rounded-full px-3 py-2 text-sm min-h-[40px] w-44"
                />
              ) : (
                <div
                  key={t.id}
                  className={`flex items-center rounded-full border transition-colors min-h-[40px] ${
                    tipoId === t.id
                      ? 'bg-brand-orange text-white border-brand-orange'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <button
                    onClick={() => setTipoId(t.id)}
                    className="flex items-center gap-1.5 pl-3 pr-1.5 py-2 text-sm font-medium min-h-[40px]"
                  >
                    {t.nombre}
                  </button>
                  {(!t.es_legacy || t.usa_motor_generico) && (
                    <>
                      <button
                        onClick={() => iniciarRenombre(t)}
                        className={`p-2 min-h-[40px] min-w-[36px] flex items-center justify-center ${
                          tipoId === t.id ? 'text-white/70 hover:text-white' : 'text-gray-300 hover:text-brand-orange'
                        }`}
                        title="Renombrar"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => setDuplicandoTipo(t)}
                        className={`p-2 min-h-[40px] min-w-[36px] flex items-center justify-center ${
                          tipoId === t.id ? 'text-white/70 hover:text-white' : 'text-gray-300 hover:text-brand-orange'
                        }`}
                        title="Duplicar a otro cliente"
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        onClick={() => eliminarTipo(t)}
                        className={`p-2 pr-3 min-h-[40px] min-w-[36px] flex items-center justify-center ${
                          tipoId === t.id ? 'text-white/70 hover:text-white' : 'text-gray-300 hover:text-red-500'
                        }`}
                        title="Eliminar planilla"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                  {t.es_legacy && !t.usa_motor_generico && (
                    <button
                      onClick={() => activarMotorGenerico(t)}
                      disabled={activandoId === t.id}
                      className={`flex items-center gap-1 pl-1.5 pr-3 py-2 text-xs font-semibold min-h-[40px] disabled:opacity-60 ${
                        tipoId === t.id ? 'text-white/80 hover:text-white' : 'text-gray-400 hover:text-brand-orange'
                      }`}
                      title="Activar edición completa de columnas"
                    >
                      {activandoId === t.id ? <Loader2 size={13} className="animate-spin" /> : <Unlock size={13} />}
                      Editar columnas
                    </button>
                  )}
                </div>
              )
            ))}
            {showNuevoTipo ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={nuevoNombre}
                  onChange={e => setNuevoNombre(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') crearTipo() }}
                  placeholder="Nombre del tipo (ej. Botiquines)"
                  className="border border-gray-300 rounded-full px-3 py-2 text-sm min-h-[40px] w-56"
                />
                <button
                  onClick={crearTipo}
                  disabled={creando}
                  className="bg-brand-orange text-white text-sm font-semibold px-3 py-2 rounded-full min-h-[40px] disabled:opacity-60"
                >
                  {creando ? '...' : 'Crear'}
                </button>
                <button onClick={() => { setShowNuevoTipo(false); setNuevoNombre('') }} className="p-2 text-gray-400 min-h-[40px] min-w-[40px]">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNuevoTipo(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium border border-dashed border-gray-300 text-gray-500 hover:border-brand-orange hover:text-brand-orange min-h-[40px]"
              >
                <Plus size={14} /> Nuevo tipo
              </button>
            )}
          </div>

          {error && (
            <div className="mb-4 text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg p-2">{error}</div>
          )}

          {tipoActivo && (
            <div className="flex flex-col gap-6">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Ítems de {tipoActivo.nombre}
                </p>
                <PlanillaItemsGrid
                  clienteId={clienteId}
                  tipoId={tipoActivo.id}
                  tipoSlug={tipoActivo.slug}
                  tipoNombre={tipoActivo.nombre}
                  esLegacy={tipoActivo.es_legacy}
                  usaMotorGenerico={tipoActivo.usa_motor_generico}
                  etiquetaNumero={tipoActivo.etiqueta_numero}
                  etiquetaUbicacion={tipoActivo.etiqueta_ubicacion}
                />
              </div>

              <div className="pt-6 border-t border-gray-100">
                <PlanoPlantaCard clienteId={clienteId} />
              </div>
            </div>
          )}
        </>
      )}

      {duplicandoTipo && (
        <PlanillaDuplicarModal
          tipoOrigen={duplicandoTipo}
          clientes={clientes.filter(c => c.id !== clienteId)}
          onClose={() => setDuplicandoTipo(null)}
        />
      )}
    </div>
  )
}
