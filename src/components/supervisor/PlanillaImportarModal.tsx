'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'
import {
  X, Upload, FileSpreadsheet, ArrowRight, Loader2, CheckCircle, AlertTriangle, Trash2,
} from 'lucide-react'
import type { TipoCampo } from '@/types/database'

type RolAsignado = 'numero_catalogo' | 'ubicacion_catalogo' | 'ignorar' | TipoCampo

interface ColumnaDetectada {
  header: string
  index: number
  rol: RolAsignado
  opciones: string[]
}

const OPCIONES_ROL: { valor: RolAsignado; etiqueta: string }[] = [
  { valor: 'numero_catalogo', etiqueta: 'Número (catálogo)' },
  { valor: 'ubicacion_catalogo', etiqueta: 'Ubicación (catálogo)' },
  { valor: 'check', etiqueta: 'Columna: Check OK/NO' },
  { valor: 'select', etiqueta: 'Columna: Selección' },
  { valor: 'texto', etiqueta: 'Columna: Texto libre' },
  { valor: 'numero', etiqueta: 'Columna: Numérico' },
  { valor: 'fecha', etiqueta: 'Columna: Fecha' },
  { valor: 'ubicacion', etiqueta: 'Columna: Ubicación (la completa el técnico)' },
  { valor: 'ignorar', etiqueta: 'Ignorar esta columna' },
]

function heuristicaRol(header: string): RolAsignado {
  const h = header.toLowerCase()
  if (h.includes('numero') || h.includes('número') || h.includes('n°') || h === 'n') return 'numero_catalogo'
  if (h.includes('ubicac')) return 'ubicacion_catalogo'
  return 'check'
}

async function parseArchivo(file: File): Promise<string[][]> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const hoja = wb.Sheets[wb.SheetNames[0]]
  const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, defval: '' })
  return filas.map((fila) => fila.map((celda) => String(celda ?? '').trim()))
}

interface Props {
  tipoId: string
  tipoSlug: string
  clienteId: string
  ordenSiguiente: number
  onClose: () => void
  onImported: () => void
}

type Paso = 'subir' | 'mapear' | 'importando' | 'resultado'

export default function PlanillaImportarModal({ tipoId, tipoSlug, clienteId, ordenSiguiente, onClose, onImported }: Props) {
  const [paso, setPaso] = useState<Paso>('subir')
  const [error, setError] = useState<string | null>(null)
  const [filasArchivo, setFilasArchivo] = useState<string[][]>([]) // incluye header en [0]
  const [columnas, setColumnas] = useState<ColumnaDetectada[]>([])
  const [progreso, setProgreso] = useState({ actual: 0, total: 0 })
  const [resultado, setResultado] = useState<{ camposOk: number; camposError: string[]; filasOk: number; filasError: string[] }>({
    camposOk: 0, camposError: [], filasOk: 0, filasError: [],
  })

  const filasDatos = filasArchivo.slice(1)

  async function handleFile(file: File) {
    setError(null)
    try {
      const filas = await parseArchivo(file)
      if (filas.length < 2) {
        setError('El archivo no tiene filas de datos (solo encabezado, o está vacío)')
        return
      }
      const headers = filas[0]
      setFilasArchivo(filas)
      setColumnas(headers.map((header, index) => ({
        header: header || `Columna ${index + 1}`,
        index,
        rol: heuristicaRol(header),
        opciones: [],
      })))
      setPaso('mapear')
    } catch {
      setError('No se pudo leer el archivo. Confirmá que sea un .xlsx o .csv válido.')
    }
  }

  function cambiarRol(index: number, rol: RolAsignado) {
    setColumnas((prev) => prev.map((c) => {
      if (c.index !== index) return c
      if (rol === 'select' && c.opciones.length === 0) {
        const distintos = Array.from(new Set(
          filasDatos.map((fila) => fila[index]?.trim()).filter((v) => v)
        ))
        return { ...c, rol, opciones: distintos }
      }
      return { ...c, rol }
    }))
  }

  function actualizarOpciones(index: number, opciones: string[]) {
    setColumnas((prev) => prev.map((c) => (c.index === index ? { ...c, opciones } : c)))
  }

  const colNumero = columnas.find((c) => c.rol === 'numero_catalogo')
  const colUbicacion = columnas.find((c) => c.rol === 'ubicacion_catalogo')
  const colsCampo = columnas.filter((c) => c.rol !== 'numero_catalogo' && c.rol !== 'ubicacion_catalogo' && c.rol !== 'ignorar')

  async function confirmarImportacion() {
    if (!colNumero) { setError('Elegí qué columna es el "Número" de cada ítem'); return }
    setError(null)
    setPaso('importando')

    const camposCreados: { index: number; clave: string }[] = []
    const camposError: string[] = []
    setProgreso({ actual: 0, total: colsCampo.length + filasDatos.length })

    for (let i = 0; i < colsCampo.length; i++) {
      const c = colsCampo[i]
      const body: Record<string, unknown> = {
        planilla_tipo_id: tipoId,
        etiqueta: c.header,
        orden: ordenSiguiente + i,
        tipo_campo: c.rol,
      }
      if (c.rol === 'select') body.opciones = c.opciones
      try {
        const res = await fetch('/api/supervisor/planilla-tipo-campos', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        })
        const json = await res.json()
        if (res.ok) camposCreados.push({ index: c.index, clave: json.campo.clave })
        else camposError.push(`${c.header}: ${json.error ?? 'error desconocido'}`)
      } catch {
        camposError.push(`${c.header}: error de conexión`)
      }
      setProgreso((p) => ({ ...p, actual: p.actual + 1 }))
    }

    let filasOk = 0
    const filasError: string[] = []
    for (let i = 0; i < filasDatos.length; i++) {
      const fila = filasDatos[i]
      const numero = fila[colNumero.index]?.trim()
      if (!numero) { filasError.push(`Fila ${i + 2}: sin número`); setProgreso((p) => ({ ...p, actual: p.actual + 1 })); continue }
      const ubicacion = colUbicacion ? fila[colUbicacion.index]?.trim() : undefined
      try {
        const res = await fetch('/api/supervisor/planilla-items', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cliente_id: clienteId, tipo: tipoSlug, numero, ubicacion: ubicacion || undefined, orden: i }),
        })
        const json = await res.json()
        if (res.ok) filasOk++
        else filasError.push(`Fila ${i + 2} (${numero}): ${json.error ?? 'error desconocido'}`)
      } catch {
        filasError.push(`Fila ${i + 2} (${numero}): error de conexión`)
      }
      setProgreso((p) => ({ ...p, actual: p.actual + 1 }))
    }

    setResultado({ camposOk: camposCreados.length, camposError, filasOk, filasError })
    setPaso('resultado')
    onImported()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
          <div>
            <p className="text-xs font-semibold text-brand-orange uppercase tracking-wide">Importar</p>
            <h2 className="text-base font-bold text-brand-ink">Cargar planilla desde Excel</h2>
          </div>
          <button onClick={onClose} className="p-2.5 min-h-[44px] min-w-[44px] text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4">
          {error && (
            <div className="mb-3 text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg p-2">{error}</div>
          )}

          {paso === 'subir' && (
            <div>
              <p className="text-xs text-gray-400 mb-4">
                Subí un archivo .xlsx o .csv con la primera fila de encabezados. En el paso siguiente
                elegís qué columna es el Número, cuál la Ubicación, y qué tipo tiene cada columna extra.
              </p>
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl py-10 cursor-pointer hover:border-brand-orange hover:bg-gray-50">
                <Upload size={24} className="text-gray-400" />
                <span className="text-sm text-gray-500">Elegir archivo .xlsx o .csv</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                />
              </label>
            </div>
          )}

          {paso === 'mapear' && (
            <div>
              <p className="text-xs text-gray-400 mb-3 flex items-center gap-1.5">
                <FileSpreadsheet size={13} /> {filasDatos.length} filas detectadas — elegí qué es cada columna
              </p>
              <div className="flex flex-col gap-3 mb-4">
                {columnas.map((c) => (
                  <div key={c.index} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-brand-ink flex-1 truncate" title={c.header}>{c.header}</span>
                      <select
                        value={c.rol}
                        onChange={(e) => cambiarRol(c.index, e.target.value as RolAsignado)}
                        className="border border-gray-300 rounded-lg px-2 py-2 text-xs min-h-[40px]"
                      >
                        {OPCIONES_ROL.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
                      </select>
                    </div>
                    {c.rol === 'select' && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {c.opciones.map((op) => (
                          <span key={op} className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-1 text-xs text-brand-ink">
                            {op}
                            <button onClick={() => actualizarOpciones(c.index, c.opciones.filter((o) => o !== op))} className="text-gray-300 hover:text-red-500">
                              <Trash2 size={10} />
                            </button>
                          </span>
                        ))}
                        {c.opciones.length === 0 && <p className="text-xs text-gray-400 italic">Sin opciones detectadas — se pueden agregar después desde &quot;Editar campo&quot;.</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-400 mb-2">Vista previa (primeras filas):</p>
              <div className="overflow-x-auto border border-gray-200 rounded-lg mb-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {columnas.filter((c) => c.rol !== 'ignorar').map((c) => (
                        <th key={c.index} className="px-2 py-1.5 text-left font-semibold text-gray-500">{c.header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filasDatos.slice(0, 5).map((fila, i) => (
                      <tr key={i} className="border-b border-gray-100 last:border-0">
                        {columnas.filter((c) => c.rol !== 'ignorar').map((c) => (
                          <td key={c.index} className="px-2 py-1.5 text-gray-600">{fila[c.index] || '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={confirmarImportacion}
                className="w-full flex items-center justify-center gap-2 bg-brand-orange text-white font-semibold py-3 rounded-lg text-sm min-h-[44px]"
              >
                Importar {colsCampo.length} columna{colsCampo.length === 1 ? '' : 's'} y {filasDatos.length} fila{filasDatos.length === 1 ? '' : 's'}
                <ArrowRight size={16} />
              </button>
            </div>
          )}

          {paso === 'importando' && (
            <div className="flex flex-col items-center justify-center gap-3 py-10">
              <Loader2 size={28} className="animate-spin text-brand-orange" />
              <p className="text-sm text-gray-500">Importando {progreso.actual} de {progreso.total}...</p>
            </div>
          )}

          {paso === 'resultado' && (
            <div>
              <div className="flex items-center gap-2 mb-3 text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                <CheckCircle size={18} className="shrink-0" />
                {resultado.camposOk} columna{resultado.camposOk === 1 ? '' : 's'} y {resultado.filasOk} fila{resultado.filasOk === 1 ? '' : 's'} importadas correctamente.
              </div>
              {(resultado.camposError.length > 0 || resultado.filasError.length > 0) && (
                <div className="flex flex-col gap-1.5 mb-3 text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs">
                  <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle size={13} /> Algunas filas/columnas no se pudieron importar:</p>
                  {[...resultado.camposError, ...resultado.filasError].map((msg) => <p key={msg}>• {msg}</p>)}
                </div>
              )}
              <button
                onClick={onClose}
                className="w-full bg-brand-orange text-white font-semibold py-3 rounded-lg text-sm min-h-[44px]"
              >
                Listo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
