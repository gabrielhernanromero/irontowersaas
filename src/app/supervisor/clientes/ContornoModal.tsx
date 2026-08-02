'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { X, MapPin, PencilRuler, AlertTriangle } from 'lucide-react'

const ContornoSedeMap = dynamic(() => import('@/components/maps/ContornoSedeMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full rounded-xl bg-gray-100 animate-pulse flex items-center justify-center text-sm text-gray-400">
      Cargando mapa...
    </div>
  ),
})

// Aviso no bloqueante — punto de partida, ajustable con datos reales.
const AREA_MIN_SOSPECHOSA_M2 = 20
const AREA_MAX_SOSPECHOSA_M2 = 100_000 // 10 ha
const MIN_VERTICES = 3

interface Props {
  clienteId: string
  clienteNombre: string
  lat: number
  lng: number
  contornoInicial: GeoJSON.Polygon | null
  onClose: () => void
  onSave: (contorno: GeoJSON.Polygon | null, actualizadoAt: string | null) => void
}

function contarVertices(geojson: GeoJSON.Polygon | null): number {
  if (!geojson) return 0
  // El primer y el último punto del anillo son el mismo (polígono cerrado).
  return Math.max(0, geojson.coordinates[0].length - 1)
}

export default function ContornoModal({
  clienteId, clienteNombre, lat, lng, contornoInicial, onClose, onSave,
}: Props) {
  const [empezado, setEmpezado] = useState(!!contornoInicial)
  const [geojson, setGeojson] = useState<GeoJSON.Polygon | null>(contornoInicial)
  const [areaM2, setAreaM2] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const vertices = contarVertices(geojson)
  const puedeGuardar = vertices >= MIN_VERTICES

  async function handleGuardar() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/supervisor/puestos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: clienteId, contorno_geojson: geojson }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al guardar el contorno'); return }
      onSave(json.puesto.contorno_geojson ?? null, json.puesto.contorno_actualizado_at ?? null)
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="font-bold text-brand-ink">Contorno de la sede</h2>
            <p className="text-xs text-gray-400">{clienteNombre}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <X size={20} />
          </button>
        </div>

        {!empezado ? (
          <div className="p-8 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-brand-orange/10 flex items-center justify-center">
              <MapPin size={26} className="text-brand-orange" />
            </div>
            <div>
              <p className="font-semibold text-brand-ink mb-1">Todavía no tiene contorno dibujado</p>
              <p className="text-sm text-gray-500 max-w-sm">
                Vas a marcar el perímetro real de la sede sobre una imagen satelital.
                Es solo una referencia visual — no reemplaza la geocerca por distancia que ya está activa.
              </p>
            </div>
            <button
              onClick={() => setEmpezado(true)}
              className="mt-2 flex items-center gap-2 bg-brand-orange text-white font-bold px-5 py-3 rounded-xl min-h-[48px]"
            >
              <PencilRuler size={16} />
              Dibujar contorno de la sede
            </button>
          </div>
        ) : (
          <>
            <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 text-xs text-blue-800 shrink-0">
              {vertices === 0 && 'Tocá el mapa para marcar el primer vértice del contorno.'}
              {vertices > 0 && vertices < MIN_VERTICES &&
                `Llevás ${vertices} de ${MIN_VERTICES} puntos mínimos — seguí marcando el perímetro.`}
              {vertices >= MIN_VERTICES &&
                `Contorno con ${vertices} vértices. Podés seguir ajustando los puntos o guardar.`}
              {' '}Backspace deshace el último punto mientras estás dibujando.
            </div>

            <div className="h-[420px] p-4">
              <ContornoSedeMap
                lat={lat}
                lng={lng}
                contornoInicial={contornoInicial}
                onChange={(g, area) => { setGeojson(g); setAreaM2(area) }}
              />
            </div>

            <div className="px-5 pb-2 shrink-0 flex flex-col gap-2">
              {areaM2 !== null && (
                <div className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-gray-500">Área del contorno</span>
                  <span className="font-semibold text-brand-ink">
                    {Math.round(areaM2).toLocaleString('es-AR')} m²
                  </span>
                </div>
              )}
              {areaM2 !== null && (areaM2 < AREA_MIN_SOSPECHOSA_M2 || areaM2 > AREA_MAX_SOSPECHOSA_M2) && (
                <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  {areaM2 < AREA_MIN_SOSPECHOSA_M2
                    ? 'El área parece muy chica — revisá que el contorno esté bien dibujado.'
                    : 'El área parece muy grande — revisá que el contorno esté bien dibujado.'}
                </div>
              )}
            </div>
          </>
        )}

        {error && (
          <p className="mx-5 mb-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3 shrink-0">
            {error}
          </p>
        )}

        {empezado && (
          <div className="p-4 border-t border-gray-100 flex gap-3 shrink-0">
            <button
              onClick={onClose}
              className="flex-1 py-3 border-2 border-gray-200 rounded-xl font-bold text-gray-600 min-h-[48px]"
            >
              Cancelar
            </button>
            <button
              onClick={handleGuardar}
              disabled={!puedeGuardar || saving}
              className="flex-1 py-3 bg-brand-orange text-white rounded-xl font-bold min-h-[48px] disabled:opacity-40"
            >
              {saving ? 'Guardando...' : 'Guardar contorno'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
