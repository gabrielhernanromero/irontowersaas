'use client'

import { useState, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import {
  Plus, Trash2, Loader2, ClipboardPaste, ToggleLeft, ToggleRight, Eye, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, MoreVertical, Pencil,
  CheckSquare, List, Type, Hash, Calendar, MapPin, Table2, Upload, Download,
} from 'lucide-react'
import { TIPOS_EXTINTOR } from '@/components/forms/ExtintorRow'
import PlanillaPreviewModal from './PlanillaPreviewModal'
import PlanillaCampoModal from './PlanillaCampoModal'
import PlanillaImportarModal from './PlanillaImportarModal'
import type { PlanillaTipoCampo, TipoCampo } from '@/types/database'

const ICONO_TIPO_CAMPO: Record<TipoCampo, typeof CheckSquare> = {
  check: CheckSquare,
  select: List,
  texto: Type,
  numero: Hash,
  fecha: Calendar,
  ubicacion: MapPin,
}

export const CAMPOS_LEGACY: Record<string, { clave: string; etiqueta: string }[]> = {
  hidrantes: [
    { clave: 'gabinete', etiqueta: 'Gabinete' },
    { clave: 'manga', etiqueta: 'Manga' },
    { clave: 'lanza', etiqueta: 'Lanza' },
    { clave: 'valvula', etiqueta: 'Válvula' },
  ],
  extintores: [
    { clave: 'senalizacion', etiqueta: 'Señalización' },
    { clave: 'acceso', etiqueta: 'Acceso' },
    { clave: 'presion_peso', etiqueta: 'Presión/Peso' },
  ],
}

interface ItemRow {
  id: string
  cliente_id: string
  tipo: string
  numero: string
  tipo_extintor: string | null
  ubicacion: string | null
  orden: number
  activo: boolean
}

interface Props {
  clienteId: string
  tipoId: string
  tipoSlug: string
  tipoNombre: string
  esLegacy: boolean
  usaMotorGenerico: boolean
  etiquetaNumero: string
  etiquetaUbicacion: string
}

const inputCls = 'w-full border-0 bg-transparent px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/40 rounded min-h-[40px]'
const thCls = 'px-2 py-2 font-semibold text-gray-500 text-xs'
const thInputCls = 'w-full border-0 bg-transparent font-semibold text-gray-600 text-xs focus:outline-none focus:ring-2 focus:ring-brand-orange/40 rounded px-1 py-1 min-h-[32px]'

export default function PlanillaItemsGrid({ clienteId, tipoId, tipoSlug, tipoNombre, esLegacy, usaMotorGenerico, etiquetaNumero, etiquetaUbicacion }: Props) {
  const [items, setItems] = useState<ItemRow[]>([])
  const [campos, setCampos] = useState<PlanillaTipoCampo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cantidadNueva, setCantidadNueva] = useState('10')
  const [showPreview, setShowPreview] = useState(false)
  const [showImportar, setShowImportar] = useState(false)
  const [campoModal, setCampoModal] = useState<{ modo: 'crear' } | { modo: 'editar'; campo: PlanillaTipoCampo } | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [labelNumero, setLabelNumero] = useState(etiquetaNumero)
  const [labelUbicacion, setLabelUbicacion] = useState(etiquetaUbicacion)
  const [colWidths, setColWidths] = useState<Record<string, number>>({})
  const tableRef = useRef<HTMLDivElement>(null)
  const resizingRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null)

  function anchoDe(key: string, porDefecto: number) {
    return colWidths[key] ?? porDefecto
  }

  function onResizeMove(e: PointerEvent) {
    const r = resizingRef.current
    if (!r) return
    const next = Math.min(480, Math.max(70, r.startWidth + (e.clientX - r.startX)))
    setColWidths(prev => ({ ...prev, [r.key]: next }))
  }

  function onResizeEnd() {
    resizingRef.current = null
    window.removeEventListener('pointermove', onResizeMove)
    window.removeEventListener('pointerup', onResizeEnd)
  }

  function startResize(key: string, porDefecto: number) {
    return (e: React.PointerEvent) => {
      e.preventDefault()
      resizingRef.current = { key, startX: e.clientX, startWidth: anchoDe(key, porDefecto) }
      window.addEventListener('pointermove', onResizeMove)
      window.addEventListener('pointerup', onResizeEnd)
    }
  }

  // Columnas de chequeo bloqueadas (hardcodeadas en el código) solo si es
  // legacy Y todavía no se activó "edición completa" para este cliente+tipo.
  const bloqueado = esLegacy && !usaMotorGenerico
  const showTipoExtintor = tipoSlug === 'extintores'
  const camposPreview = bloqueado ? (CAMPOS_LEGACY[tipoSlug] ?? []) : campos

  // Al cambiar de tipo, el componente no se remonta (sin `key`) — sincronizar
  // las etiquetas locales con las del tipo recién seleccionado.
  useEffect(() => {
    setLabelNumero(etiquetaNumero)
    setLabelUbicacion(etiquetaUbicacion)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoId])

  function recargar() {
    setLoading(true)
    return Promise.all([
      fetch(`/api/supervisor/planilla-items?cliente_id=${clienteId}&tipo=${tipoSlug}`).then(r => r.json()),
      bloqueado
        ? Promise.resolve({ campos: [] })
        : fetch(`/api/supervisor/planilla-tipo-campos?planilla_tipo_id=${tipoId}`).then(r => r.json()),
    ]).then(([itemsJson, camposJson]) => {
      setItems(itemsJson.items ?? [])
      setCampos(camposJson.campos ?? [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => {
    recargar()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, tipoId, tipoSlug, bloqueado])

  function prefijo() {
    const existente = items.find(i => /^[A-Za-z]+-/.test(i.numero))
    if (existente) return existente.numero.split('-')[0]
    return tipoNombre.charAt(0).toUpperCase()
  }

  async function crearFila(numero: string, ubicacion = '', tipoExtintor = '') {
    const res = await fetch('/api/supervisor/planilla-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente_id: clienteId,
        tipo: tipoSlug,
        numero,
        ubicacion: ubicacion || undefined,
        tipo_extintor: showTipoExtintor ? (tipoExtintor || TIPOS_EXTINTOR[0]) : undefined,
        orden: items.length,
      }),
    })
    const json = await res.json()
    if (res.ok) setItems(prev => [...prev, json.item])
    return res.ok
  }

  async function agregarFilas() {
    const n = Math.max(1, Math.min(500, parseInt(cantidadNueva) || 1))
    setError(null)
    const pre = prefijo()
    for (let i = 0; i < n; i++) {
      const numero = `${pre}-${String(items.length + i + 1).padStart(3, '0')}`
      const ok = await crearFila(numero)
      if (!ok) { setError('Error al agregar filas'); break }
    }
  }

  async function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData('text/plain')
    if (!text.includes('\t') && !text.includes('\n')) return // paste normal en un input, no interceptar
    e.preventDefault()
    const filas = text.split(/\r?\n/).filter(l => l.trim().length > 0)
    setError(null)
    const pre = prefijo()
    for (let i = 0; i < filas.length; i++) {
      const cols = filas[i].split('\t')
      const numero = cols[0]?.trim() || `${pre}-${String(items.length + i + 1).padStart(3, '0')}`
      const ubicacion = cols[1]?.trim() ?? ''
      const tipoExtintor = showTipoExtintor ? (cols[2]?.trim() ?? '') : ''
      const ok = await crearFila(numero, ubicacion, tipoExtintor)
      if (!ok) { setError('Algunas filas pegadas no se pudieron guardar (¿número repetido?)'); }
    }
  }

  async function actualizarCampo(item: ItemRow, campo: 'numero' | 'ubicacion' | 'tipo_extintor', valor: string) {
    if ((item[campo] ?? '') === valor) return
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, [campo]: valor } : i))
    const res = await fetch('/api/supervisor/planilla-items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, [campo]: valor }),
    })
    if (!res.ok) {
      const json = await res.json()
      setError(json.error ?? 'Error al guardar')
    }
  }

  async function toggleActivo(item: ItemRow) {
    const res = await fetch('/api/supervisor/planilla-items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, activo: !item.activo }),
    })
    if (res.ok) setItems(prev => prev.map(i => i.id === item.id ? { ...i, activo: !i.activo } : i))
  }

  async function eliminarFila(item: ItemRow) {
    if (!confirm(`¿Eliminar "${item.numero}"? Esto no afecta planillas ya enviadas.`)) return
    const res = await fetch(`/api/supervisor/planilla-items?id=${item.id}`, { method: 'DELETE' })
    if (res.ok) setItems(prev => prev.filter(i => i.id !== item.id))
  }

  async function moverFila(item: ItemRow, direccion: -1 | 1) {
    const idx = items.findIndex(i => i.id === item.id)
    const vecino = items[idx + direccion]
    if (!vecino) return
    const next = [...items]
    ;[next[idx], next[idx + direccion]] = [next[idx + direccion], next[idx]]
    setItems(next)
    const [r1, r2] = await Promise.all([
      fetch('/api/supervisor/planilla-items', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, orden: vecino.orden }) }),
      fetch('/api/supervisor/planilla-items', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: vecino.id, orden: item.orden }) }),
    ])
    if (!r1.ok || !r2.ok) setError('Error al reordenar la fila')
  }

  async function renombrarEtiquetaColumna(campo: 'etiqueta_numero' | 'etiqueta_ubicacion', valor: string) {
    const actual = campo === 'etiqueta_numero' ? labelNumero : labelUbicacion
    if (!valor.trim() || valor === actual) return
    if (campo === 'etiqueta_numero') setLabelNumero(valor); else setLabelUbicacion(valor)
    const res = await fetch('/api/supervisor/planilla-tipos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: tipoId, [campo]: valor }),
    })
    if (!res.ok) {
      const json = await res.json()
      setError(json.error ?? 'Error al renombrar la columna')
    }
  }

  async function eliminarCampo(campo: PlanillaTipoCampo) {
    if (!confirm(`¿Eliminar la columna "${campo.etiqueta}"? El técnico ya no la va a ver.`)) return
    const res = await fetch(`/api/supervisor/planilla-tipo-campos?id=${campo.id}`, { method: 'DELETE' })
    if (res.ok) setCampos(prev => prev.filter(c => c.id !== campo.id))
  }

  async function moverCampo(campo: PlanillaTipoCampo, direccion: -1 | 1) {
    const idx = campos.findIndex(c => c.id === campo.id)
    const vecino = campos[idx + direccion]
    if (!vecino) return
    const next = [...campos]
    ;[next[idx], next[idx + direccion]] = [next[idx + direccion], next[idx]]
    setCampos(next)
    const [r1, r2] = await Promise.all([
      fetch('/api/supervisor/planilla-tipo-campos', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: campo.id, orden: vecino.orden }) }),
      fetch('/api/supervisor/planilla-tipo-campos', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: vecino.id, orden: campo.orden }) }),
    ])
    if (!r1.ok || !r2.ok) setError('Error al reordenar la columna')
  }

  function handleCampoGuardado(campoGuardado: PlanillaTipoCampo) {
    setCampos(prev => {
      const existe = prev.some(c => c.id === campoGuardado.id)
      return existe ? prev.map(c => c.id === campoGuardado.id ? campoGuardado : c) : [...prev, campoGuardado]
    })
  }

  function exportarExcel() {
    const headers = [
      labelNumero,
      labelUbicacion,
      ...(showTipoExtintor ? ['Tipo'] : []),
      ...camposPreview.map(c => {
        const campo = c as { etiqueta: string; opciones?: string[] }
        return campo.opciones && campo.opciones.length > 0 ? `${campo.etiqueta} (${campo.opciones.join('/')})` : campo.etiqueta
      }),
    ]
    const filas = items.map(item => [
      item.numero,
      item.ubicacion ?? '',
      ...(showTipoExtintor ? [item.tipo_extintor ?? ''] : []),
      ...camposPreview.map(() => ''),
    ])
    const ws = XLSX.utils.aoa_to_sheet([headers, ...filas])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Planilla')
    const nombreArchivo = `${tipoNombre.replace(/[^a-zA-Z0-9À-ÿ ]/g, '').trim() || 'planilla'}.xlsx`
    XLSX.writeFile(wb, nombreArchivo)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <Loader2 size={20} className="animate-spin text-gray-300" />
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap bg-gray-50/60 border border-gray-100 rounded-xl px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Filas:</span>
          <input
            type="number"
            min={1}
            max={500}
            value={cantidadNueva}
            onChange={e => setCantidadNueva(e.target.value)}
            className="w-16 border border-gray-300 rounded-lg p-2 text-sm text-center min-h-[40px] bg-white"
          />
          <button
            onClick={agregarFilas}
            className="flex items-center gap-1 bg-brand-orange text-white text-xs font-semibold px-3 py-2 rounded-lg min-h-[40px]"
          >
            <Plus size={14} /> Agregar filas
          </button>
          <button
            onClick={() => setShowPreview(true)}
            disabled={items.length === 0}
            className="flex items-center gap-1 border border-gray-200 bg-white text-gray-600 text-xs font-semibold px-3 py-2 rounded-lg min-h-[40px] disabled:opacity-40 hover:border-brand-orange hover:text-brand-orange"
            title="Ver cómo queda la planilla para el técnico"
          >
            <Eye size={14} /> Vista previa
          </button>
          {!bloqueado && (
            <button
              onClick={() => setShowImportar(true)}
              className="flex items-center gap-1 border border-gray-200 bg-white text-gray-600 text-xs font-semibold px-3 py-2 rounded-lg min-h-[40px] hover:border-brand-orange hover:text-brand-orange"
              title="Crear columnas e ítems de una vez desde un archivo Excel/CSV"
            >
              <Upload size={14} /> Importar Excel
            </button>
          )}
          <button
            onClick={exportarExcel}
            disabled={items.length === 0 && campos.length === 0}
            className="flex items-center gap-1 border border-gray-200 bg-white text-gray-600 text-xs font-semibold px-3 py-2 rounded-lg min-h-[40px] disabled:opacity-40 hover:border-brand-orange hover:text-brand-orange"
            title="Descargar el catálogo actual como Excel"
          >
            <Download size={14} /> Exportar Excel
          </button>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-gray-400">
          <ClipboardPaste size={13} /> Pegá un rango copiado de Excel/Sheets en cualquier celda
        </p>
      </div>

      {error && (
        <div className="mb-3 text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg p-2">{error}</div>
      )}

      {!bloqueado && campos.length > 0 && (
        <p className="mb-3 text-xs text-brand-blue bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
          Las columnas de chequeo (Estado, Selección, etc.) las completa el técnico al enviar la planilla — por eso esas celdas quedan vacías (—) y no se pueden editar acá. Número y Ubicación sí son el catálogo que cargás vos.
        </p>
      )}

      {items.length === 0 && campos.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 border border-dashed border-gray-200 rounded-xl text-center">
          <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
            <Table2 size={22} className="text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-brand-ink">Sin filas ni columnas todavía</p>
          <p className="text-xs text-gray-400 max-w-xs">
            Agregá filas y columnas con los botones de arriba, o pegá una lista copiada desde Excel/Sheets.
          </p>
        </div>
      ) : (
        <div ref={tableRef} className="overflow-x-auto border border-gray-300 rounded-xl" onPaste={handlePaste}>
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col style={{ width: anchoDe('numero', 112) }} />
              <col style={{ width: anchoDe('ubicacion', 200) }} />
              {showTipoExtintor && <col style={{ width: anchoDe('tipoExtintor', 128) }} />}
              {!bloqueado && campos.map(c => (
                <col key={c.id} style={{ width: anchoDe(c.id, 144) }} />
              ))}
              {!bloqueado && <col style={{ width: 130 }} />}
              <col style={{ width: 64 }} />
              <col style={{ width: 40 }} />
              <col style={{ width: 40 }} />
            </colgroup>
            <thead className="sticky top-0 z-20">
              <tr className="bg-gray-50 border-b border-gray-300 divide-x divide-gray-300 text-left">
                <th className={`${thCls} relative sticky left-0 z-10 bg-gray-50`}>
                  <div className="flex items-center gap-1.5">
                    <Hash size={12} className="text-gray-400 shrink-0" />
                    {bloqueado ? labelNumero : (
                      <input
                        key={`numero-${tipoId}`}
                        defaultValue={labelNumero}
                        onBlur={e => renombrarEtiquetaColumna('etiqueta_numero', e.target.value)}
                        className={thInputCls}
                        title="Nombre de la columna"
                      />
                    )}
                  </div>
                  <span
                    onPointerDown={startResize('numero', 112)}
                    className="absolute top-0 right-0 h-full w-2.5 cursor-col-resize touch-none select-none hover:bg-brand-orange/40 active:bg-brand-orange/60"
                    title="Arrastrar para cambiar el ancho"
                  />
                </th>
                <th className={`${thCls} relative`}>
                  <div className="flex items-center gap-1.5">
                    <MapPin size={12} className="text-gray-400 shrink-0" />
                    {bloqueado ? labelUbicacion : (
                      <input
                        key={`ubicacion-${tipoId}`}
                        defaultValue={labelUbicacion}
                        onBlur={e => renombrarEtiquetaColumna('etiqueta_ubicacion', e.target.value)}
                        className={thInputCls}
                        title="Nombre de la columna"
                      />
                    )}
                  </div>
                  <span
                    onPointerDown={startResize('ubicacion', 200)}
                    className="absolute top-0 right-0 h-full w-2.5 cursor-col-resize touch-none select-none hover:bg-brand-orange/40 active:bg-brand-orange/60"
                    title="Arrastrar para cambiar el ancho"
                  />
                </th>
                {showTipoExtintor && (
                  <th className={`${thCls} relative`}>
                    <div className="flex items-center gap-1.5">
                      <List size={12} className="text-gray-400 shrink-0" />
                      Tipo
                    </div>
                    <span
                      onPointerDown={startResize('tipoExtintor', 128)}
                      className="absolute top-0 right-0 h-full w-2.5 cursor-col-resize touch-none select-none hover:bg-brand-orange/40 active:bg-brand-orange/60"
                      title="Arrastrar para cambiar el ancho"
                    />
                  </th>
                )}
                {!bloqueado && campos.map((c, idx) => {
                  const IconoTipo = ICONO_TIPO_CAMPO[c.tipo_campo] ?? CheckSquare
                  return (
                    <th key={c.id} className={`${thCls} relative`}>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="flex items-center border border-gray-200 rounded shrink-0 bg-white">
                            <button
                              onClick={() => moverCampo(c, -1)}
                              disabled={idx === 0}
                              className="p-1 min-h-[22px] min-w-[18px] text-gray-500 hover:text-brand-orange disabled:opacity-25 disabled:cursor-not-allowed"
                              title="Mover columna a la izquierda"
                            >
                              <ChevronLeft size={12} />
                            </button>
                            <button
                              onClick={() => moverCampo(c, 1)}
                              disabled={idx === campos.length - 1}
                              className="p-1 min-h-[22px] min-w-[18px] text-gray-500 hover:text-brand-orange disabled:opacity-25 disabled:cursor-not-allowed border-l border-gray-200"
                              title="Mover columna a la derecha"
                            >
                              <ChevronRight size={12} />
                            </button>
                          </div>
                          <button
                            onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                            className="p-1.5 min-h-[28px] min-w-[28px] text-gray-500 hover:text-brand-orange hover:bg-gray-100 rounded shrink-0"
                            title="Editar o eliminar columna"
                          >
                            <MoreVertical size={14} />
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <IconoTipo size={12} className="text-gray-400 shrink-0" />
                          <span className="flex-1 truncate" title={c.etiqueta}>{c.etiqueta}</span>
                        </div>
                      </div>
                      {openMenuId === c.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                          <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1 normal-case font-normal">
                            <button
                              onClick={() => { setOpenMenuId(null); setCampoModal({ modo: 'editar', campo: c }) }}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 text-left min-h-[40px]"
                            >
                              <Pencil size={13} /> Editar campo
                            </button>
                            <button
                              onClick={() => { setOpenMenuId(null); eliminarCampo(c) }}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 text-left min-h-[40px]"
                            >
                              <Trash2 size={13} /> Eliminar columna
                            </button>
                          </div>
                        </>
                      )}
                      <span
                        onPointerDown={startResize(c.id, 144)}
                        className="absolute top-0 right-0 h-full w-2.5 cursor-col-resize touch-none select-none hover:bg-brand-orange/40 active:bg-brand-orange/60"
                        title="Arrastrar para cambiar el ancho"
                      />
                    </th>
                  )
                })}
                {!bloqueado && (
                  <th className={`${thCls} w-32`}>
                    <button
                      onClick={() => setCampoModal({ modo: 'crear' })}
                      className="flex items-center gap-1 text-brand-orange font-semibold text-xs px-2 py-1.5 min-h-[32px] hover:underline"
                    >
                      <Plus size={12} /> Columna
                    </button>
                  </th>
                )}
                <th className="px-2 py-2 font-semibold text-gray-500 text-xs w-16 text-center">Activo</th>
                <th className="px-2 py-2 w-10" />
                <th className="px-2 py-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const filaBg = i % 2 === 1 ? 'bg-gray-50' : 'bg-white'
                return (
                <tr key={item.id} className={`border-b border-gray-200 last:border-0 divide-x divide-gray-200 hover:bg-blue-50/40 transition-colors ${!item.activo ? 'opacity-50' : ''} ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                  <td className={`sticky left-0 z-[5] ${filaBg}`}>
                    <input
                      defaultValue={item.numero}
                      onBlur={e => actualizarCampo(item, 'numero', e.target.value)}
                      className={`${inputCls} font-mono`}
                    />
                  </td>
                  <td>
                    <input
                      defaultValue={item.ubicacion ?? ''}
                      onBlur={e => actualizarCampo(item, 'ubicacion', e.target.value)}
                      placeholder="Piso 3, pasillo norte"
                      className={inputCls}
                    />
                  </td>
                  {showTipoExtintor && (
                    <td>
                      <select
                        defaultValue={item.tipo_extintor ?? TIPOS_EXTINTOR[0]}
                        onChange={e => actualizarCampo(item, 'tipo_extintor', e.target.value)}
                        className={inputCls}
                      >
                        {TIPOS_EXTINTOR.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                  )}
                  {!bloqueado && campos.map(c => (
                    <td key={c.id} className="text-center text-gray-300 text-xs" title="El técnico completa esto al enviar la planilla">
                      —
                    </td>
                  ))}
                  {!bloqueado && <td />}
                  <td className="text-center">
                    <button onClick={() => toggleActivo(item)} className="p-2.5 min-h-[44px] min-w-[44px] text-gray-400 hover:text-brand-ink inline-flex items-center justify-center">
                      {item.activo ? <ToggleRight size={16} className="text-green-500" /> : <ToggleLeft size={16} />}
                    </button>
                  </td>
                  <td className="text-center">
                    <button onClick={() => eliminarFila(item)} className="p-2.5 min-h-[44px] min-w-[44px] text-gray-400 hover:text-red-500 inline-flex items-center justify-center">
                      <Trash2 size={13} />
                    </button>
                  </td>
                  <td className="text-center">
                    <div className="flex flex-col items-center border border-gray-200 rounded w-fit mx-auto bg-white">
                      <button
                        onClick={() => moverFila(item, -1)}
                        disabled={i === 0}
                        className="p-1 min-h-[20px] min-w-[26px] text-gray-500 hover:text-brand-orange disabled:opacity-25 disabled:cursor-not-allowed inline-flex items-center justify-center"
                        title="Subir fila"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        onClick={() => moverFila(item, 1)}
                        disabled={i === items.length - 1}
                        className="p-1 min-h-[20px] min-w-[26px] text-gray-500 hover:text-brand-orange disabled:opacity-25 disabled:cursor-not-allowed inline-flex items-center justify-center border-t border-gray-200"
                        title="Bajar fila"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {items.length > 0 && (
        <p className="text-xs text-gray-400 mt-2">
          {items.length} {items.length === 1 ? 'ítem' : 'ítems'}
        </p>
      )}

      {showPreview && (
        <PlanillaPreviewModal
          tipoNombre={tipoNombre}
          campos={camposPreview}
          items={items.filter(i => i.activo)}
          onClose={() => setShowPreview(false)}
        />
      )}

      {campoModal && (
        <PlanillaCampoModal
          planillaTipoId={tipoId}
          campo={campoModal.modo === 'editar' ? campoModal.campo : null}
          ordenSiguiente={campos.length}
          onClose={() => setCampoModal(null)}
          onSaved={handleCampoGuardado}
        />
      )}

      {showImportar && (
        <PlanillaImportarModal
          tipoId={tipoId}
          tipoSlug={tipoSlug}
          clienteId={clienteId}
          ordenSiguiente={campos.length}
          onClose={() => setShowImportar(false)}
          onImported={recargar}
        />
      )}
    </div>
  )
}
