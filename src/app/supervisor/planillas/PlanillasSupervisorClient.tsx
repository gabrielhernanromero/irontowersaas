'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import {
  History, Settings, Plus, X, Loader2, Edit2, Trash2, Unlock, Copy,
  Sun, Moon, ChevronDown, ChevronRight, Search, Download, AlertTriangle,
} from 'lucide-react'
import PlanoPlantaCard from '@/components/supervisor/PlanoPlantaCard'
import PlanillaItemsGrid, { CAMPOS_LEGACY } from '@/components/supervisor/PlanillaItemsGrid'
import PlanillaDuplicarModal from '@/components/supervisor/PlanillaDuplicarModal'
import { downloadCsv } from '@/lib/exportCsv'
import type { PlanillaTipo } from '@/types/database'

type Tab = 'historial' | 'configuracion'

interface PlanillaRow {
  id: string
  tipo: string
  fecha: string
  turno: string
  inmutable: boolean
  tecnico_id: string | null
  cliente_id: string | null
  tieneNovedad: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  users?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientes?: any
}

interface Tecnico {
  id: string
  nombre: string
  apellido: string
}

interface Props {
  planillas: PlanillaRow[]
  searchParams: { tipo?: string; tecnico_id?: string; cliente_id?: string; desde?: string; hasta?: string; agrupar?: string; q?: string; filtro?: string }
  clientes: { id: string; nombre_empresa: string }[]
  tecnicos: Tecnico[]
  limiteAlcanzado: boolean
}

export default function PlanillasSupervisorClient({ planillas, searchParams, clientes, tecnicos, limiteAlcanzado }: Props) {
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
        <HistorialTab planillas={planillas} searchParams={searchParams} clientes={clientes} tecnicos={tecnicos} limiteAlcanzado={limiteAlcanzado} />
      ) : (
        <ConfiguracionTab clientes={clientes} />
      )}
    </div>
  )
}

// ── Historial ───────────────────────────────────────────────────────────────

function isoHoy(): string {
  return new Date().toLocaleDateString('sv-SE', {
    timeZone: 'America/Argentina/Buenos_Aires',
  })
}

function isoHace(dias: number): string {
  return new Date(Date.now() - dias * 86400000).toLocaleDateString('sv-SE', {
    timeZone: 'America/Argentina/Buenos_Aires',
  })
}

function fmtFecha(iso: string) {
  if (iso === isoHoy()) return 'Hoy'
  if (iso === isoHace(1)) return 'Ayer'
  const texto = new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function fmtFechaCorta(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', {
    day: 'numeric', month: 'short',
  })
}

function ordenTurno(turno: string) {
  return turno === 'diurno' ? 0 : 1
}

function nombreTecnico(p: PlanillaRow) {
  return p.users ? `${p.users.apellido}, ${p.users.nombre}` : ''
}

type AgruparPor = 'fecha' | 'tecnico'
type FiltroRapido = 'todos' | 'enviadas' | 'borradores' | 'novedades'

interface Grupo {
  clave: string
  titulo: string
  planillas: PlanillaRow[]
}

function HistorialTab({
  planillas, searchParams, clientes, tecnicos, limiteAlcanzado,
}: {
  planillas: PlanillaRow[]
  searchParams: { tipo?: string; tecnico_id?: string; cliente_id?: string; desde?: string; hasta?: string; agrupar?: string; q?: string; filtro?: string }
  clientes: { id: string; nombre_empresa: string }[]
  tecnicos: Tecnico[]
  limiteAlcanzado: boolean
}) {
  const [agruparPor, setAgruparPor] = useState<AgruparPor>(
    searchParams.agrupar === 'tecnico' ? 'tecnico' : 'fecha'
  )
  const [colapsados, setColapsados] = useState<Set<string>>(new Set())
  const [busqueda, setBusqueda] = useState(searchParams.q ?? '')
  const filtrosValidos: FiltroRapido[] = ['todos', 'enviadas', 'borradores', 'novedades']
  const [filtroRapido, setFiltroRapido] = useState<FiltroRapido>(
    filtrosValidos.includes(searchParams.filtro as FiltroRapido) ? (searchParams.filtro as FiltroRapido) : 'todos'
  )
  const busquedaRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== '/') return
      const target = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      e.preventDefault()
      busquedaRef.current?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const kpis = useMemo(() => {
    const total = planillas?.length ?? 0
    const enviadas = (planillas ?? []).filter(p => p.inmutable).length
    const conNovedades = (planillas ?? []).filter(p => p.tieneNovedad).length
    return { total, enviadas, borradores: total - enviadas, conNovedades }
  }, [planillas])

  const planillasFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    return (planillas ?? []).filter(p => {
      if (filtroRapido === 'enviadas' && !p.inmutable) return false
      if (filtroRapido === 'borradores' && p.inmutable) return false
      if (filtroRapido === 'novedades' && !p.tieneNovedad) return false
      if (!texto) return true
      const haystack = `${nombreTecnico(p)} ${p.clientes?.nombre_empresa ?? ''}`.toLowerCase()
      return haystack.includes(texto)
    })
  }, [planillas, busqueda, filtroRapido])

  function exportarCsv() {
    const rows = planillasFiltradas.map(p => ({
      fecha: p.fecha,
      turno: p.turno,
      tecnico: nombreTecnico(p),
      cliente: p.clientes?.nombre_empresa ?? '',
      tipo: p.tipo,
      estado: p.inmutable ? 'Enviada' : 'Borrador',
      con_novedades: p.tieneNovedad ? 'Sí' : 'No',
    }))
    downloadCsv(rows, 'planillas-historial')
  }

  const grupos = useMemo<Grupo[]>(() => {
    if (agruparPor === 'fecha') {
      const porFecha = new Map<string, PlanillaRow[]>()
      for (const p of planillasFiltradas) {
        if (!porFecha.has(p.fecha)) porFecha.set(p.fecha, [])
        porFecha.get(p.fecha)!.push(p)
      }
      return Array.from(porFecha.keys())
        .sort((a, b) => b.localeCompare(a))
        .map(fecha => ({
          clave: fecha,
          titulo: fmtFecha(fecha),
          planillas: [...porFecha.get(fecha)!].sort((a, b) =>
            ordenTurno(a.turno) - ordenTurno(b.turno) || nombreTecnico(a).localeCompare(nombreTecnico(b))
          ),
        }))
    }

    const porTecnico = new Map<string, PlanillaRow[]>()
    for (const p of planillasFiltradas) {
      const clave = p.tecnico_id ?? 'sin-tecnico'
      if (!porTecnico.has(clave)) porTecnico.set(clave, [])
      porTecnico.get(clave)!.push(p)
    }
    return Array.from(porTecnico.entries())
      .map(([clave, items]) => {
        const u = items[0]?.users
        const titulo = u ? `${u.apellido}, ${u.nombre}` : 'Sin técnico asignado'
        const ordenados = [...items].sort((a, b) =>
          b.fecha.localeCompare(a.fecha) || ordenTurno(a.turno) - ordenTurno(b.turno)
        )
        return { clave, titulo, planillas: ordenados }
      })
      .sort((a, b) => a.titulo.localeCompare(b.titulo))
  }, [planillasFiltradas, agruparPor])

  function toggleGrupo(clave: string) {
    setColapsados(prev => {
      const next = new Set(prev)
      next.has(clave) ? next.delete(clave) : next.add(clave)
      return next
    })
  }

  return (
    <div className="max-w-4xl">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiTile
          label="Total" value={kpis.total} color="text-brand-ink"
          activo={filtroRapido === 'todos'}
          onClick={() => setFiltroRapido('todos')}
        />
        <KpiTile
          label="Enviadas" value={kpis.enviadas} color="text-green-600"
          activo={filtroRapido === 'enviadas'}
          onClick={() => setFiltroRapido(v => v === 'enviadas' ? 'todos' : 'enviadas')}
        />
        <KpiTile
          label="Borradores" value={kpis.borradores} color="text-yellow-600"
          activo={filtroRapido === 'borradores'}
          onClick={() => setFiltroRapido(v => v === 'borradores' ? 'todos' : 'borradores')}
        />
        <KpiTile
          label="Con novedades" value={kpis.conNovedades} color="text-red-600"
          activo={filtroRapido === 'novedades'}
          onClick={() => setFiltroRapido(v => v === 'novedades' ? 'todos' : 'novedades')}
        />
      </div>

      <form className="flex gap-3 mb-4 flex-wrap items-center">
        <input type="hidden" name="agrupar" value={agruparPor} />
        <input type="hidden" name="q" value={busqueda} />
        <input type="hidden" name="filtro" value={filtroRapido} />
        <select
          name="tipo"
          defaultValue={searchParams.tipo ?? ''}
          className="border border-gray-300 rounded-xl p-2 text-sm min-h-[44px]"
        >
          <option value="">Todos los tipos</option>
          <option value="hidrantes">Hidrantes</option>
          <option value="extintores">Extintores</option>
        </select>
        <select
          name="cliente_id"
          defaultValue={searchParams.cliente_id ?? ''}
          className="border border-gray-300 rounded-xl p-2 text-sm min-h-[44px]"
        >
          <option value="">Todos los clientes</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre_empresa}</option>)}
        </select>
        <select
          name="tecnico_id"
          defaultValue={searchParams.tecnico_id ?? ''}
          className="border border-gray-300 rounded-xl p-2 text-sm min-h-[44px]"
        >
          <option value="">Todos los técnicos</option>
          {tecnicos.map(t => <option key={t.id} value={t.id}>{t.apellido}, {t.nombre}</option>)}
        </select>
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            name="desde"
            aria-label="Desde"
            defaultValue={searchParams.desde ?? ''}
            max={searchParams.hasta ?? isoHoy()}
            className="border border-gray-300 rounded-xl p-2 text-sm min-h-[44px]"
          />
          <span className="text-gray-400 text-sm">→</span>
          <input
            type="date"
            name="hasta"
            aria-label="Hasta"
            defaultValue={searchParams.hasta ?? ''}
            min={searchParams.desde ?? undefined}
            max={isoHoy()}
            className="border border-gray-300 rounded-xl p-2 text-sm min-h-[44px]"
          />
        </div>
        <button
          type="submit"
          className="bg-brand-blue text-white px-4 py-2 rounded-xl text-sm min-h-[44px]"
        >
          Filtrar
        </button>
      </form>

      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Agrupar por</span>
          <div className="flex rounded-full border border-gray-200 overflow-hidden">
            {(['fecha', 'tecnico'] as AgruparPor[]).map(opcion => (
              <button
                key={opcion}
                onClick={() => setAgruparPor(opcion)}
                aria-pressed={agruparPor === opcion}
                className={`px-3 py-2 text-xs font-medium min-h-[44px] transition-colors ${
                  agruparPor === opcion
                    ? 'bg-brand-orange text-white'
                    : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                {opcion === 'fecha' ? 'Fecha' : 'Técnico'}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full sm:w-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={busquedaRef}
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar técnico o cliente... (/)"
            aria-label="Buscar técnico o cliente"
            className="border border-gray-300 rounded-xl pl-9 pr-3 py-2 text-sm min-h-[44px] w-full sm:w-56"
          />
        </div>

        <button
          onClick={exportarCsv}
          disabled={!planillasFiltradas.length}
          className="flex items-center gap-1.5 text-sm border border-gray-200 rounded-xl px-3 py-2 min-h-[44px] text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors ml-auto"
        >
          <Download size={13} />
          Exportar CSV
        </button>
      </div>

      {!planillasFiltradas.length && (
        <p className="text-gray-500 text-sm">
          {!planillas?.length ? 'No hay planillas con esos filtros.' : 'Nada coincide con la búsqueda/filtro rápido.'}
        </p>
      )}

      <div className="flex flex-col gap-4">
        {grupos.map(grupo => {
          const abierto = !colapsados.has(grupo.clave)
          return (
            <div key={grupo.clave} className="rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <button
                onClick={() => toggleGrupo(grupo.clave)}
                aria-expanded={abierto}
                className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50/80 sticky top-0 z-10 min-h-[44px] text-left"
              >
                <span className="text-sm font-semibold text-brand-ink flex-1">{grupo.titulo}</span>
                <span className="text-xs text-gray-400 shrink-0">
                  {grupo.planillas.length} {grupo.planillas.length === 1 ? 'planilla' : 'planillas'}
                </span>
                <ChevronDown size={15} className={`text-gray-400 transition-transform ${abierto ? '' : '-rotate-90'}`} />
              </button>

              {abierto && (
                <div className="flex flex-col divide-y divide-gray-100 bg-white">
                  {grupo.planillas.map(p => (
                    <PlanillaCard key={p.id} planilla={p} mostrarFecha={agruparPor === 'tecnico'} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {limiteAlcanzado && (
        <p className="text-xs text-gray-400 text-center mt-4">
          Mostrando los últimos 50 resultados — afiná los filtros para ver planillas más específicas.
        </p>
      )}
    </div>
  )
}

function KpiTile({
  label, value, color, activo, onClick,
}: {
  label: string
  value: number
  color: string
  activo?: boolean
  onClick?: () => void
}) {
  const Componente = onClick ? 'button' : 'div'
  return (
    <Componente
      onClick={onClick}
      aria-pressed={onClick ? activo : undefined}
      className={`text-left bg-white border rounded-xl p-3 min-h-[44px] transition-colors ${
        activo ? 'border-brand-orange ring-1 ring-brand-orange/20' : 'border-gray-100'
      } ${onClick ? 'hover:bg-gray-50' : ''}`}
    >
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </Componente>
  )
}

function PlanillaCard({ planilla: p, mostrarFecha }: { planilla: PlanillaRow; mostrarFecha: boolean }) {
  const esDiurno = p.turno === 'diurno'
  return (
    <Link
      href={`/supervisor/planillas/${p.id}`}
      className="group grid grid-cols-12 gap-2 items-center p-4 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-inset min-h-[44px]"
    >
      <div className="col-span-5 sm:col-span-4">
        <p className="font-semibold text-brand-ink flex items-center gap-1.5">
          {p.users?.apellido}, {p.users?.nombre}
          {p.tieneNovedad && (
            <AlertTriangle size={13} className="text-red-500 shrink-0" aria-label="Tiene ítems marcados como NO" />
          )}
        </p>
        <p className="text-sm text-gray-500 capitalize">
          {p.tipo} · {p.clientes?.nombre_empresa}
        </p>
      </div>

      <div className="col-span-3 flex items-center gap-1.5 text-xs text-gray-500">
        {esDiurno ? <Sun size={13} className="text-amber-500 shrink-0" /> : <Moon size={13} className="text-indigo-400 shrink-0" />}
        <span className="capitalize">{p.turno}</span>
        {mostrarFecha && <span className="text-gray-400">· {fmtFechaCorta(p.fecha)}</span>}
      </div>

      <div className="col-span-4 sm:col-span-3">
        <span
          className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${
            p.inmutable
              ? 'bg-green-100 text-green-700'
              : 'bg-yellow-100 text-yellow-700'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${p.inmutable ? 'bg-green-500' : 'bg-yellow-500'}`} />
          {p.inmutable ? 'Enviada' : 'Borrador'}
        </span>
      </div>

      <div className="hidden sm:flex col-span-2 justify-end">
        <ChevronRight size={16} className="text-gray-300 group-hover:text-brand-orange transition-colors" />
      </div>
    </Link>
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
