'use client'

import { useEffect, useState } from 'react'
import { X, Copy, Loader2, CheckCircle, AlertTriangle } from 'lucide-react'
import type { PlanillaTipo, PlanillaTipoCampo } from '@/types/database'

interface ItemOrigen {
  numero: string
  ubicacion: string | null
  tipo_extintor: string | null
  orden: number
}

interface Props {
  tipoOrigen: PlanillaTipo
  clientes: { id: string; nombre_empresa: string }[]
  onClose: () => void
}

type Paso = 'elegir' | 'duplicando' | 'resultado'

export default function PlanillaDuplicarModal({ tipoOrigen, clientes, onClose }: Props) {
  const [clienteDestino, setClienteDestino] = useState(clientes[0]?.id ?? '')
  const [copiarItems, setCopiarItems] = useState(true)
  const [cantidadItems, setCantidadItems] = useState<number | null>(null)
  const [paso, setPaso] = useState<Paso>('elegir')
  const [error, setError] = useState<string | null>(null)
  const [progreso, setProgreso] = useState({ actual: 0, total: 0 })
  const [resultado, setResultado] = useState<{ nombreDestino: string; camposOk: number; itemsOk: number; errores: string[] }>({
    nombreDestino: '', camposOk: 0, itemsOk: 0, errores: [],
  })

  useEffect(() => {
    fetch(`/api/supervisor/planilla-items?cliente_id=${tipoOrigen.cliente_id}&tipo=${tipoOrigen.slug}`)
      .then(r => r.json())
      .then(j => setCantidadItems((j.items ?? []).length))
      .catch(() => setCantidadItems(0))
  }, [tipoOrigen.cliente_id, tipoOrigen.slug])

  async function confirmarDuplicado() {
    if (!clienteDestino) { setError('Elegí un cliente destino'); return }
    setError(null)
    setPaso('duplicando')

    const errores: string[] = []

    // 1. Traer columnas (y opcionalmente ítems) del tipo origen
    const [camposRes, itemsRes] = await Promise.all([
      fetch(`/api/supervisor/planilla-tipo-campos?planilla_tipo_id=${tipoOrigen.id}`).then(r => r.json()),
      copiarItems
        ? fetch(`/api/supervisor/planilla-items?cliente_id=${tipoOrigen.cliente_id}&tipo=${tipoOrigen.slug}`).then(r => r.json())
        : Promise.resolve({ items: [] }),
    ])
    const camposOrigen: PlanillaTipoCampo[] = camposRes.campos ?? []
    const itemsOrigen: ItemOrigen[] = itemsRes.items ?? []

    setProgreso({ actual: 0, total: 1 + camposOrigen.length + itemsOrigen.length })

    // 2. Crear el tipo en el cliente destino
    const resTipo = await fetch('/api/supervisor/planilla-tipos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cliente_id: clienteDestino, nombre: tipoOrigen.nombre }),
    })
    const jsonTipo = await resTipo.json()
    if (!resTipo.ok) {
      setError(jsonTipo.error ?? 'No se pudo crear el tipo en el cliente destino')
      setPaso('elegir')
      return
    }
    const tipoDestino = jsonTipo.tipo
    setProgreso(p => ({ ...p, actual: p.actual + 1 }))

    // 3. Copiar etiquetas de Número/Ubicación si son distintas de las por defecto
    if (tipoOrigen.etiqueta_numero !== 'Número' || tipoOrigen.etiqueta_ubicacion !== 'Ubicación') {
      await fetch('/api/supervisor/planilla-tipos', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tipoDestino.id,
          etiqueta_numero: tipoOrigen.etiqueta_numero,
          etiqueta_ubicacion: tipoOrigen.etiqueta_ubicacion,
        }),
      })
    }

    // 4. Copiar columnas
    let camposOk = 0
    for (const c of camposOrigen) {
      const body: Record<string, unknown> = {
        planilla_tipo_id: tipoDestino.id, etiqueta: c.etiqueta, orden: c.orden, tipo_campo: c.tipo_campo,
      }
      if (c.tipo_campo === 'select') body.opciones = c.opciones
      if (c.tipo_campo === 'numero') { body.valor_min = c.valor_min; body.valor_max = c.valor_max }
      const res = await fetch('/api/supervisor/planilla-tipo-campos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (res.ok) camposOk++
      else { const j = await res.json(); errores.push(`Columna "${c.etiqueta}": ${j.error ?? 'error desconocido'}`) }
      setProgreso(p => ({ ...p, actual: p.actual + 1 }))
    }

    // 5. Copiar ítems (si corresponde)
    let itemsOk = 0
    for (const it of itemsOrigen) {
      const body: Record<string, unknown> = {
        cliente_id: clienteDestino, tipo: tipoDestino.slug, numero: it.numero, orden: it.orden,
      }
      if (it.ubicacion) body.ubicacion = it.ubicacion
      if (it.tipo_extintor) body.tipo_extintor = it.tipo_extintor
      const res = await fetch('/api/supervisor/planilla-items', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (res.ok) itemsOk++
      else { const j = await res.json(); errores.push(`Ítem "${it.numero}": ${j.error ?? 'error desconocido'}`) }
      setProgreso(p => ({ ...p, actual: p.actual + 1 }))
    }

    const nombreDestino = clientes.find(c => c.id === clienteDestino)?.nombre_empresa ?? 'el cliente destino'
    setResultado({ nombreDestino, camposOk, itemsOk, errores })
    setPaso('resultado')
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-xs font-semibold text-brand-orange uppercase tracking-wide">Duplicar</p>
            <h2 className="text-base font-bold text-brand-ink">{tipoOrigen.nombre}</h2>
          </div>
          <button onClick={onClose} className="p-2.5 min-h-[44px] min-w-[44px] text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4">
          {error && (
            <div className="mb-3 text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg p-2">{error}</div>
          )}

          {paso === 'elegir' && (
            <div>
              {clientes.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No hay otro cliente activo para duplicar esta planilla.</p>
              ) : (
                <>
                  <p className="text-xs text-gray-400 mb-4">
                    Crea una copia de las columnas de &quot;{tipoOrigen.nombre}&quot; en otro cliente.
                  </p>
                  <label className="block text-xs text-gray-500 mb-1">Cliente destino</label>
                  <select
                    value={clienteDestino}
                    onChange={(e) => setClienteDestino(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[44px] mb-4"
                  >
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre_empresa}</option>)}
                  </select>

                  <label className="flex items-center gap-2 text-sm text-brand-ink mb-5">
                    <input
                      type="checkbox"
                      checked={copiarItems}
                      onChange={(e) => setCopiarItems(e.target.checked)}
                      className="w-4 h-4"
                    />
                    También copiar {cantidadItems === null ? 'los' : `los ${cantidadItems}`} ítem{cantidadItems === 1 ? '' : 's'} del catálogo
                  </label>

                  <button
                    onClick={confirmarDuplicado}
                    className="w-full flex items-center justify-center gap-2 bg-brand-orange text-white font-semibold py-3 rounded-lg text-sm min-h-[44px]"
                  >
                    <Copy size={15} /> Duplicar
                  </button>
                </>
              )}
            </div>
          )}

          {paso === 'duplicando' && (
            <div className="flex flex-col items-center justify-center gap-3 py-10">
              <Loader2 size={28} className="animate-spin text-brand-orange" />
              <p className="text-sm text-gray-500">Duplicando {progreso.actual} de {progreso.total}...</p>
            </div>
          )}

          {paso === 'resultado' && (
            <div>
              <div className="flex items-center gap-2 mb-3 text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                <CheckCircle size={18} className="shrink-0" />
                Se creó &quot;{tipoOrigen.nombre}&quot; en {resultado.nombreDestino} con {resultado.camposOk} columna{resultado.camposOk === 1 ? '' : 's'}
                {copiarItems && ` y ${resultado.itemsOk} ítem${resultado.itemsOk === 1 ? '' : 's'}`}.
              </div>
              {resultado.errores.length > 0 && (
                <div className="flex flex-col gap-1.5 mb-3 text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs">
                  <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle size={13} /> Algunos elementos no se pudieron copiar:</p>
                  {resultado.errores.map((msg) => <p key={msg}>• {msg}</p>)}
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
