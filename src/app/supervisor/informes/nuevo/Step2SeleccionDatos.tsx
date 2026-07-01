'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ChevronRight, ChevronDown, Loader2, AlertTriangle,
  Settings2, Clock, Shield, AlertCircle, X, Check,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Cliente { id: string; nombre_empresa: string }

interface LibroNovedad { id: string; hora: string; descripcion: string }

interface IncidenciaItem {
  id: string
  titulo: string
  estado: string
  created_at: string
  seguimiento_resumen?: string | null
}

interface RondaItem {
  id: string
  hora_inicio: string
  puntos_verificados?: number | null
}

interface TurnoData {
  id: string
  tecnico_nombre: string
  turno: 'diurno' | 'nocturno'
  horario_inicio: string
  novedades: LibroNovedad[]
  incidencias: IncidenciaItem[]
  rondas: RondaItem[]
}

interface DiaData {
  fecha: string
  turnos: TurnoData[]
}

interface ResumenData {
  turnos: number
  incidencias: number
  rondas: number
}

export interface SeleccionDatos {
  clienteId: string
  fechaDesde: string
  fechaHasta: string
  turnoIds: string[]
  incidenciaIds: string[]
  rondaIds: string[]
  libroIds: string[]
}

interface Props {
  clientes: Cliente[]
  onConfirm: (seleccion: SeleccionDatos) => void
  onBack: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtFecha(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

function fmtHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function diaAllIds(dia: DiaData): string[] {
  const ids: string[] = []
  for (const t of dia.turnos) {
    ids.push(t.id, ...t.novedades.map(n => n.id), ...t.incidencias.map(i => i.id), ...t.rondas.map(r => r.id))
  }
  return ids
}

function turnoAllIds(t: TurnoData): string[] {
  return [t.id, ...t.novedades.map(n => n.id), ...t.incidencias.map(i => i.id), ...t.rondas.map(r => r.id)]
}

// ── Checkbox con soporte indeterminate ────────────────────────────────────────
// El estado `indeterminate` no es un prop de React — requiere manipulación por ref.
// Se activa cuando ALGUNOS (no todos) los hijos están seleccionados.

function CheckboxCell({
  checked,
  indeterminate,
  onChange,
  className = '',
}: {
  checked: boolean
  indeterminate?: boolean
  onChange: () => void
  className?: string
}) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate
  }, [indeterminate])

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className={`w-4 h-4 rounded border-gray-300 accent-brand-orange cursor-pointer shrink-0 ${className}`}
    />
  )
}

// ── Mock Supabase (documentación de queries reales) ───────────────────────────
/*
  RESUMEN — ejecutar al seleccionar fechas (solo COUNT, muy liviano):
  ─────────────────────────────────────────────────────────────────────
  const [{ count: nTurnos }, { count: nIncs }, { count: nRondas }] = await Promise.all([
    supabase.from('turnos')
      .select('*', { count: 'exact', head: true })
      .eq('cliente_id', clienteId)
      .gte('fecha', fechaDesde)
      .lte('fecha', fechaHasta),
    supabase.from('incidencias')
      .select('*', { count: 'exact', head: true })
      .eq('cliente_id', clienteId)
      .gte('created_at', `${fechaDesde}T00:00:00`)
      .lte('created_at', `${fechaHasta}T23:59:59`),
    supabase.from('rondas')
      .select('*', { count: 'exact', head: true })
      .eq('cliente_id', clienteId)
      .gte('fecha_inicio', `${fechaDesde}T00:00:00`)
      .lte('fecha_inicio', `${fechaHasta}T23:59:59`),
  ])

  ÁRBOL COMPLETO — ejecutar SOLO al abrir el Sheet (lazy load):
  ─────────────────────────────────────────────────────────────────────
  const { data: turnos } = await supabase
    .from('turnos')
    .select(`
      id, tecnico_nombre, turno, horario_inicio, fecha,
      libro_guardia_novedades ( id, hora, descripcion ),
      incidencias ( id, titulo, estado, created_at, seguimiento_resumen ),
      rondas ( id, hora_inicio, puntos_verificados )
    `)
    .eq('cliente_id', clienteId)
    .gte('fecha', fechaDesde)
    .lte('fecha', fechaHasta)
    .order('fecha', { ascending: true })
    .order('horario_inicio', { ascending: true })

  // Agrupar por fecha para construir DiaData[]:
  const arbol = turnos.reduce<DiaData[]>((acc, t) => {
    let dia = acc.find(d => d.fecha === t.fecha)
    if (!dia) { dia = { fecha: t.fecha, turnos: [] }; acc.push(dia) }
    dia.turnos.push({
      id: t.id, tecnico_nombre: t.tecnico_nombre, turno: t.turno,
      horario_inicio: t.horario_inicio,
      novedades: t.libro_guardia_novedades ?? [],
      incidencias: t.incidencias ?? [],
      rondas: t.rondas ?? [],
    })
    return acc
  }, [])
*/

// ── Datos mock para desarrollo ────────────────────────────────────────────────

function buildMockArbol(desde: string, hasta: string): DiaData[] {
  const dias: DiaData[] = []
  const start = new Date(desde + 'T00:00:00')
  const end   = new Date(hasta + 'T00:00:00')
  const cur   = new Date(start)
  let idx = 0

  while (cur <= end && idx < 7) {
    const fecha = cur.toISOString().slice(0, 10)
    dias.push({
      fecha,
      turnos: [
        {
          id: `t-${fecha}-d`,
          tecnico_nombre: 'Juan Pérez',
          turno: 'diurno',
          horario_inicio: `${fecha}T08:00:00`,
          novedades: [
            { id: `n-${fecha}-1`, hora: '08:15', descripcion: 'Inicio de turno sin novedades. Control de elementos asignados completo.' },
            { id: `n-${fecha}-2`, hora: '12:30', descripcion: 'Ronda perimetral sector norte. Sin anomalías.' },
          ],
          incidencias: idx % 2 === 0 ? [
            { id: `i-${fecha}-1`, titulo: 'Hidrante H-012 sin presión', estado: 'abierto', created_at: `${fecha}T10:22:00`, seguimiento_resumen: 'Notificado a mantenimiento. Pendiente revisión técnica.' },
          ] : [],
          rondas: [
            { id: `r-${fecha}-d1`, hora_inicio: `${fecha}T09:00:00`, puntos_verificados: 12 },
            { id: `r-${fecha}-d2`, hora_inicio: `${fecha}T15:00:00`, puntos_verificados: 12 },
          ],
        },
        {
          id: `t-${fecha}-n`,
          tecnico_nombre: 'María González',
          turno: 'nocturno',
          horario_inicio: `${fecha}T20:00:00`,
          novedades: [
            { id: `n-${fecha}-n1`, hora: '20:05', descripcion: 'Relevo recibido. Sin novedades relevantes.' },
          ],
          incidencias: [],
          rondas: [
            { id: `r-${fecha}-n1`, hora_inicio: `${fecha}T22:00:00`, puntos_verificados: 12 },
          ],
        },
      ],
    })
    cur.setDate(cur.getDate() + 1)
    idx++
  }
  return dias
}

// ── Sheet: Panel de ajuste granular ──────────────────────────────────────────

function AjustarSheet({
  open,
  arbol,
  loading,
  selectedIds,
  onChange,
  onClose,
  onAplicar,
}: {
  open: boolean
  arbol: DiaData[]
  loading: boolean
  selectedIds: Set<string>
  onChange: (next: Set<string>) => void
  onClose: () => void
  onAplicar: () => void
}) {
  const [openDias,   setOpenDias]   = useState<Set<string>>(new Set())
  const [openTurnos, setOpenTurnos] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (arbol.length) {
      setOpenDias(new Set(arbol.map(d => d.fecha)))
      setOpenTurnos(new Set(arbol.flatMap(d => d.turnos.map(t => t.id))))
    }
  }, [arbol])

  function toggleDia(dia: DiaData) {
    const all = diaAllIds(dia)
    const allSelected = all.every(id => selectedIds.has(id))
    const next = new Set(selectedIds)
    allSelected ? all.forEach(id => next.delete(id)) : all.forEach(id => next.add(id))
    onChange(next)
  }

  function toggleTurno(t: TurnoData) {
    const all = turnoAllIds(t)
    const allSelected = all.every(id => selectedIds.has(id))
    const next = new Set(selectedIds)
    allSelected ? all.forEach(id => next.delete(id)) : all.forEach(id => next.add(id))
    onChange(next)
  }

  function toggleItem(id: string) {
    const next = new Set(selectedIds)
    next.has(id) ? next.delete(id) : next.add(id)
    onChange(next)
  }

  function diaState(dia: DiaData) {
    const all = diaAllIds(dia)
    const n = all.filter(id => selectedIds.has(id)).length
    return { checked: n === all.length, indeterminate: n > 0 && n < all.length }
  }

  function turnoState(t: TurnoData) {
    const all = turnoAllIds(t)
    const n = all.filter(id => selectedIds.has(id)).length
    return { checked: n === all.length, indeterminate: n > 0 && n < all.length }
  }

  // Contadores en vivo para el footer
  const counters = arbol.reduce(
    (acc, dia) => {
      for (const t of dia.turnos) {
        if (selectedIds.has(t.id)) acc.turnos++
        acc.totalTurnos++
        acc.incidencias     += t.incidencias.filter(i => selectedIds.has(i.id)).length
        acc.totalIncidencias += t.incidencias.length
        acc.rondas          += t.rondas.filter(r => selectedIds.has(r.id)).length
        acc.totalRondas     += t.rondas.length
      }
      return acc
    },
    { turnos: 0, totalTurnos: 0, incidencias: 0, totalIncidencias: 0, rondas: 0, totalRondas: 0 }
  )

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/20 z-40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />

      {/* Sheet */}
      <div className={`fixed right-0 top-0 h-full w-full max-w-lg bg-white z-50 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Ajustar selección</h3>
            <p className="text-xs text-gray-400 mt-0.5">Desmarcar elementos para excluirlos del informe</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors mt-0.5">
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <Loader2 size={22} className="animate-spin text-brand-orange" />
              <p className="text-xs text-gray-400">Cargando datos del período...</p>
            </div>
          ) : arbol.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2">
              <p className="text-sm text-gray-400">No hay registros en el período seleccionado.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {arbol.map(dia => {
                const ds = diaState(dia)
                const dOpen = openDias.has(dia.fecha)

                return (
                  <div key={dia.fecha}>
                    {/* Nivel 1: Día */}
                    <div className="flex items-center gap-3 px-5 py-3 bg-gray-50/80 sticky top-0 z-10 border-b border-gray-100">
                      <CheckboxCell
                        checked={ds.checked}
                        indeterminate={ds.indeterminate}
                        onChange={() => toggleDia(dia)}
                      />
                      <button
                        onClick={() => {
                          const next = new Set(openDias)
                          next.has(dia.fecha) ? next.delete(dia.fecha) : next.add(dia.fecha)
                          setOpenDias(next)
                        }}
                        className="flex items-center gap-1.5 flex-1 text-left"
                      >
                        <span className="text-sm font-semibold text-gray-800 capitalize">{fmtFecha(dia.fecha)}</span>
                        <ChevronDown size={13} className={`text-gray-400 transition-transform ${dOpen ? '' : '-rotate-90'}`} />
                      </button>
                      <span className="text-xs text-gray-400 shrink-0">
                        {dia.turnos.length} {dia.turnos.length === 1 ? 'turno' : 'turnos'}
                      </span>
                    </div>

                    {/* Nivel 2: Turnos */}
                    {dOpen && (
                      <div className="divide-y divide-gray-50">
                        {dia.turnos.map(t => {
                          const ts = turnoState(t)
                          const tOpen = openTurnos.has(t.id)

                          return (
                            <div key={t.id}>
                              {/* Turno header */}
                              <div className="flex items-center gap-3 pl-11 pr-4 py-2.5 bg-white">
                                <CheckboxCell
                                  checked={ts.checked}
                                  indeterminate={ts.indeterminate}
                                  onChange={() => toggleTurno(t)}
                                />
                                <button
                                  onClick={() => {
                                    const next = new Set(openTurnos)
                                    next.has(t.id) ? next.delete(t.id) : next.add(t.id)
                                    setOpenTurnos(next)
                                  }}
                                  className="flex items-center gap-2.5 flex-1 text-left min-w-0"
                                >
                                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${t.turno === 'diurno' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                    {t.turno === 'diurno' ? 'Diurno' : 'Nocturno'}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-800 truncate">{t.tecnico_nombre}</p>
                                    <p className="text-xs text-gray-400">{fmtHora(t.horario_inicio)}</p>
                                  </div>
                                  <ChevronDown size={12} className={`text-gray-400 transition-transform shrink-0 ${tOpen ? '' : '-rotate-90'}`} />
                                </button>
                              </div>

                              {/* Nivel 3: Contenido del turno */}
                              {tOpen && (
                                <div className="pl-16 pr-4 pb-4 space-y-4 bg-white">

                                  {/* 3A: Libro de Guardia */}
                                  <div>
                                    <div className="flex items-center gap-1.5 mb-2">
                                      <Shield size={11} className="text-blue-400" />
                                      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Libro de Guardia</span>
                                      <span className="text-[10px] text-gray-400 ml-auto">
                                        {t.novedades.filter(n => selectedIds.has(n.id)).length}/{t.novedades.length}
                                      </span>
                                    </div>
                                    {t.novedades.length === 0 ? (
                                      <p className="text-xs text-gray-400 italic">Sin novedades registradas.</p>
                                    ) : (
                                      <div className="space-y-1">
                                        {t.novedades.map(n => (
                                          <label
                                            key={n.id}
                                            className={`flex items-start gap-2.5 p-2.5 rounded-xl cursor-pointer border transition-colors ${selectedIds.has(n.id) ? 'border-blue-200 bg-blue-50/40' : 'border-gray-100 hover:bg-gray-50'}`}
                                          >
                                            <CheckboxCell checked={selectedIds.has(n.id)} onChange={() => toggleItem(n.id)} className="mt-0.5" />
                                            <div className="min-w-0">
                                              <span className="text-[11px] font-semibold text-gray-600 mr-2">{n.hora}</span>
                                              <span className="text-xs text-gray-600 leading-relaxed">{n.descripcion}</span>
                                            </div>
                                          </label>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* 3B: Incidencias */}
                                  <div>
                                    <div className="flex items-center gap-1.5 mb-2">
                                      <AlertCircle size={11} className="text-amber-400" />
                                      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Incidencias</span>
                                      <span className="text-[10px] text-gray-400 ml-auto">
                                        {t.incidencias.filter(i => selectedIds.has(i.id)).length}/{t.incidencias.length}
                                      </span>
                                    </div>
                                    {t.incidencias.length === 0 ? (
                                      <p className="text-xs text-gray-400 italic">Sin incidencias en este turno.</p>
                                    ) : (
                                      <div className="space-y-1">
                                        {t.incidencias.map(inc => (
                                          <label
                                            key={inc.id}
                                            className={`flex items-start gap-2.5 p-2.5 rounded-xl cursor-pointer border transition-colors ${selectedIds.has(inc.id) ? 'border-amber-200 bg-amber-50/40' : 'border-gray-100 hover:bg-gray-50'}`}
                                          >
                                            <CheckboxCell checked={selectedIds.has(inc.id)} onChange={() => toggleItem(inc.id)} className="mt-0.5" />
                                            <div className="min-w-0 flex-1">
                                              <div className="flex items-start gap-2 flex-wrap">
                                                <span className="text-xs font-medium text-gray-800 leading-snug">{inc.titulo}</span>
                                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${inc.estado === 'abierto' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                  {inc.estado === 'abierto' ? 'Abierta' : 'Cerrada'}
                                                </span>
                                              </div>
                                              <p className="text-[10px] text-gray-400 mt-0.5">
                                                {new Date(inc.created_at).toLocaleDateString('es-AR')}
                                              </p>
                                              {inc.seguimiento_resumen && (
                                                <p className="text-[10px] text-gray-500 mt-1 italic leading-relaxed line-clamp-2">
                                                  {inc.seguimiento_resumen}
                                                </p>
                                              )}
                                            </div>
                                          </label>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* 3C: Rondas */}
                                  <div>
                                    <div className="flex items-center gap-1.5 mb-2">
                                      <Clock size={11} className="text-emerald-400" />
                                      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Rondas perimetrales</span>
                                      <span className="text-[10px] text-gray-400 ml-auto">
                                        {t.rondas.filter(r => selectedIds.has(r.id)).length}/{t.rondas.length}
                                      </span>
                                    </div>
                                    {t.rondas.length === 0 ? (
                                      <p className="text-xs text-gray-400 italic">Sin rondas en este turno.</p>
                                    ) : (
                                      <div className="space-y-1">
                                        {t.rondas.map(r => (
                                          <label
                                            key={r.id}
                                            className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer border transition-colors ${selectedIds.has(r.id) ? 'border-emerald-200 bg-emerald-50/40' : 'border-gray-100 hover:bg-gray-50'}`}
                                          >
                                            <CheckboxCell checked={selectedIds.has(r.id)} onChange={() => toggleItem(r.id)} />
                                            <Clock size={11} className="text-gray-400 shrink-0" />
                                            <span className="text-xs text-gray-700">{fmtHora(r.hora_inicio)}</span>
                                            {r.puntos_verificados != null && (
                                              <span className="text-[10px] text-gray-400 ml-auto">{r.puntos_verificados} puntos</span>
                                            )}
                                          </label>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer con contadores en vivo + acciones */}
        <div className="border-t border-gray-100 px-5 py-4 bg-white space-y-3">
          {!loading && arbol.length > 0 && (
            <div className="flex items-center justify-between text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
              <span>
                <strong className="text-gray-800">{counters.turnos}</strong>
                <span className="text-gray-400">/{counters.totalTurnos}</span> turnos
              </span>
              <span className="text-gray-300">·</span>
              <span>
                <strong className="text-gray-800">{counters.incidencias}</strong>
                <span className="text-gray-400">/{counters.totalIncidencias}</span> incidencias
              </span>
              <span className="text-gray-300">·</span>
              <span>
                <strong className="text-gray-800">{counters.rondas}</strong>
                <span className="text-gray-400">/{counters.totalRondas}</span> rondas
              </span>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={onAplicar}
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-brand-orange rounded-xl hover:bg-orange-500 transition-colors"
            >
              Aplicar selección
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function Step2SeleccionDatos({ clientes, onConfirm, onBack }: Props) {
  const [clienteId,   setClienteId]   = useState('')
  const [fechaDesde,  setFechaDesde]  = useState('')
  const [fechaHasta,  setFechaHasta]  = useState('')
  const [resumen,     setResumen]     = useState<ResumenData | null>(null)
  const [resumenLoading, setResumenLoading] = useState(false)
  const [sheetOpen,   setSheetOpen]   = useState(false)
  const [arbol,       setArbol]       = useState<DiaData[]>([])
  const [arbolLoading, setArbolLoading] = useState(false)
  // pendingIds: cambios en el Sheet aún no confirmados
  // appliedIds: selección aplicada que irá al siguiente paso
  const [pendingIds,  setPendingIds]  = useState<Set<string>>(new Set())
  const [appliedIds,  setAppliedIds]  = useState<Set<string>>(new Set())
  const [showAlert,   setShowAlert]   = useState(false)

  const canContinue = !!clienteId && !!fechaDesde && !!fechaHasta && fechaDesde <= fechaHasta

  // Resumen: query liviana de conteos al seleccionar cliente + fechas
  useEffect(() => {
    if (!clienteId || !fechaDesde || !fechaHasta || fechaDesde > fechaHasta) {
      setResumen(null)
      return
    }
    setResumenLoading(true)
    // Mock — reemplazar con Promise.all([supabase COUNT queries])
    const t = setTimeout(() => {
      const days = Math.ceil((new Date(fechaHasta).getTime() - new Date(fechaDesde).getTime()) / 86400000) + 1
      setResumen({ turnos: days * 2, incidencias: Math.floor(days * 0.8), rondas: days * 3 })
      setResumenLoading(false)
    }, 500)
    return () => clearTimeout(t)
  }, [clienteId, fechaDesde, fechaHasta])

  // Árbol completo: lazy, solo al abrir el Sheet
  const loadArbol = useCallback(async () => {
    if (!clienteId || !fechaDesde || !fechaHasta) return
    setArbolLoading(true)
    // Mock — reemplazar con Supabase join query documentada arriba
    await new Promise(r => setTimeout(r, 700))
    const data = buildMockArbol(fechaDesde, fechaHasta)
    setArbol(data)
    const allIds = new Set(data.flatMap(diaAllIds))
    setPendingIds(new Set(allIds))
    setAppliedIds(new Set(allIds))
    setArbolLoading(false)
  }, [clienteId, fechaDesde, fechaHasta])

  function handleOpenSheet() {
    setSheetOpen(true)
    if (arbol.length === 0) loadArbol()
    else setPendingIds(new Set(appliedIds)) // reset descarta cambios pendientes no guardados
  }

  function handleAplicar() {
    setAppliedIds(new Set(pendingIds))
    setSheetOpen(false)
  }

  function handleCloseSheet() {
    setPendingIds(new Set(appliedIds)) // descartar cambios
    setSheetOpen(false)
  }

  function handleContinuar() {
    if (!canContinue) { setShowAlert(true); return }
    setShowAlert(false)

    const useApplied = appliedIds.size > 0

    onConfirm({
      clienteId,
      fechaDesde,
      fechaHasta,
      turnoIds:     useApplied ? arbol.flatMap(d => d.turnos.filter(t => appliedIds.has(t.id)).map(t => t.id)) : [],
      incidenciaIds: useApplied ? arbol.flatMap(d => d.turnos.flatMap(t => t.incidencias.filter(i => appliedIds.has(i.id)).map(i => i.id))) : [],
      rondaIds:     useApplied ? arbol.flatMap(d => d.turnos.flatMap(t => t.rondas.filter(r => appliedIds.has(r.id)).map(r => r.id))) : [],
      libroIds:     useApplied ? arbol.flatMap(d => d.turnos.flatMap(t => t.novedades.filter(n => appliedIds.has(n.id)).map(n => n.id))) : [],
    })
  }

  const clienteObj   = clientes.find(c => c.id === clienteId)
  const totalAll     = arbol.flatMap(diaAllIds).length
  const hasExcluidos = totalAll > 0 && appliedIds.size < totalAll
  const nExcluidos   = totalAll - appliedIds.size

  return (
    <div className="space-y-5">
      <h2 className="text-base font-bold text-gray-800">Selección de datos</h2>

      {/* Cliente */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          Cliente
        </label>
        <select
          value={clienteId}
          onChange={e => {
            setClienteId(e.target.value)
            setResumen(null)
            setArbol([])
            setAppliedIds(new Set())
            setShowAlert(false)
          }}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange/50 transition-shadow"
        >
          <option value="">Seleccioná un cliente</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre_empresa}</option>)}
        </select>
      </div>

      {/* Rango de fechas */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          Período
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Desde</label>
            <input
              type="date"
              value={fechaDesde}
              max={fechaHasta || undefined}
              onChange={e => { setFechaDesde(e.target.value); setArbol([]); setAppliedIds(new Set()) }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange/50 transition-shadow"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              min={fechaDesde || undefined}
              onChange={e => { setFechaHasta(e.target.value); setArbol([]); setAppliedIds(new Set()) }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange/50 transition-shadow"
            />
          </div>
        </div>
      </div>

      {/* Tarjeta de resumen — aparece al tener cliente + fechas válidas */}
      {clienteId && fechaDesde && fechaHasta && fechaDesde <= fechaHasta && (
        <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          {resumenLoading ? (
            <div className="flex items-center gap-3 px-5 py-4 text-gray-400">
              <Loader2 size={15} className="animate-spin text-brand-orange" />
              <span className="text-sm">Calculando datos del período...</span>
            </div>
          ) : resumen ? (
            <>
              <div className="px-5 pt-4 pb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Resumen del período</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center bg-blue-50 rounded-xl p-3">
                    <p className="text-2xl font-bold text-blue-700">{resumen.turnos}</p>
                    <p className="text-xs text-blue-500 mt-0.5">Turnos</p>
                  </div>
                  <div className="text-center bg-amber-50 rounded-xl p-3">
                    <p className="text-2xl font-bold text-amber-700">{resumen.incidencias}</p>
                    <p className="text-xs text-amber-500 mt-0.5">Incidencias</p>
                  </div>
                  <div className="text-center bg-emerald-50 rounded-xl p-3">
                    <p className="text-2xl font-bold text-emerald-700">{resumen.rondas}</p>
                    <p className="text-xs text-emerald-500 mt-0.5">Rondas</p>
                  </div>
                </div>
                {clienteObj && (
                  <p className="text-xs text-gray-400 mt-3 text-center">
                    {clienteObj.nombre_empresa}
                    {' · '}
                    {new Date(fechaDesde + 'T00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                    {' al '}
                    {new Date(fechaHasta + 'T00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}
              </div>

              {/* Fila de estado + botón ajustar */}
              <div className="border-t border-gray-100 px-5 py-2.5 flex items-center justify-between">
                <div className="text-xs">
                  {hasExcluidos ? (
                    <span className="text-amber-600 font-medium">
                      {nExcluidos} elemento{nExcluidos !== 1 ? 's' : ''} excluido{nExcluidos !== 1 ? 's' : ''}
                    </span>
                  ) : totalAll > 0 ? (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <Check size={12} /> Todo incluido
                    </span>
                  ) : (
                    <span className="text-gray-400">Sin ajuste aplicado</span>
                  )}
                </div>
                <button
                  onClick={handleOpenSheet}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Settings2 size={12} />
                  Ajustar selección
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Alert inline — solo se muestra al intentar continuar sin datos */}
      {showAlert && !canContinue && (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            Seleccioná un <strong>cliente</strong> y un <strong>rango de fechas</strong> válido para continuar.
          </p>
        </div>
      )}

      {/* Botones de acción */}
      <div className="flex justify-between pt-2">
        <button
          onClick={onBack}
          className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
          Atrás
        </button>
        <button
          onClick={handleContinuar}
          disabled={!canContinue}
          className="flex items-center gap-2 bg-brand-orange text-white font-semibold px-5 py-2.5 rounded-xl text-sm disabled:opacity-40 hover:bg-orange-500 transition-colors"
        >
          Continuar <ChevronRight size={16} />
        </button>
      </div>

      {/* Sheet lateral */}
      <AjustarSheet
        open={sheetOpen}
        arbol={arbol}
        loading={arbolLoading}
        selectedIds={pendingIds}
        onChange={setPendingIds}
        onClose={handleCloseSheet}
        onAplicar={handleAplicar}
      />
    </div>
  )
}
