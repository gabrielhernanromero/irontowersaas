'use client'

import { useState } from 'react'
import { X, Camera, CheckCircle, PenLine, Building2 } from 'lucide-react'
import SignatureCanvas from '@/components/signature/SignatureCanvas'
import { respuestaEsNovedad } from '@/lib/validations/planillaGenerica'

interface PreviewItem {
  numero: string
  ubicacion: string | null
  tipo_extintor?: string | null
}

interface CampoDef {
  clave: string
  etiqueta: string
  tipo_campo?: 'check' | 'select' | 'texto' | 'numero' | 'fecha' | 'ubicacion'
  opciones?: string[]
  valor_min?: number | null
  valor_max?: number | null
}

type ValorCampo = boolean | string | number

function valorPorDefecto(campo: CampoDef): ValorCampo {
  if (campo.tipo_campo === 'select') return campo.opciones?.[0] ?? ''
  if (campo.tipo_campo === 'texto' || campo.tipo_campo === 'fecha' || campo.tipo_campo === 'ubicacion') return ''
  if (campo.tipo_campo === 'numero') return campo.valor_min ?? 0
  return true // check (default)
}

interface Props {
  tipoNombre: string
  campos: CampoDef[]
  items: PreviewItem[]
  planoUrl?: string | null
  onClose: () => void
}

const MAX_ITEMS_PREVIEW = 15

export default function PlanillaPreviewModal({ tipoNombre, campos, items, planoUrl, onClose }: Props) {
  const itemsVisibles = items.slice(0, MAX_ITEMS_PREVIEW)
  const restantes = items.length - itemsVisibles.length

  // Simulación de interacción — todo en estado local del propio modal, sin
  // llamar a ninguna API ni tocar el formulario real del técnico.
  const [respuestas, setRespuestas] = useState<Record<string, Record<string, ValorCampo>>>(() =>
    Object.fromEntries(
      itemsVisibles.map((item) => [
        item.numero,
        Object.fromEntries(campos.map((c) => [c.clave, valorPorDefecto(c)])),
      ])
    )
  )
  const [observaciones, setObservaciones] = useState<Record<string, Record<string, string>>>({})
  const [fotoCargada, setFotoCargada] = useState<Record<string, boolean>>({})

  function setValor(numero: string, clave: string, valor: ValorCampo) {
    setRespuestas((prev) => ({ ...prev, [numero]: { ...prev[numero], [clave]: valor } }))
  }

  function setObs(numero: string, clave: string, valor: string) {
    setObservaciones((prev) => ({ ...prev, [numero]: { ...prev[numero], [clave]: valor } }))
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
          <div>
            <p className="text-xs font-semibold text-brand-orange uppercase tracking-wide">Vista previa</p>
            <h2 className="text-lg font-bold text-brand-ink">Planilla de {tipoNombre}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 min-h-[44px] min-w-[44px] text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-xs text-gray-400 mb-4">
            Así la va a ver y usar el técnico en su celular — podés tocar los campos para
            probar cómo se completa (datos de ejemplo, acá no se envía ni se sube nada).
          </p>

          {items.length > 0 && campos.length > 0 && (
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3 min-h-[52px] mb-4">
              <Building2 size={16} className="text-gray-400 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Puesto</p>
                <p className="font-semibold text-brand-ink text-sm">Cliente de ejemplo</p>
              </div>
              <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full capitalize bg-amber-100 text-amber-700">
                diurno
              </span>
            </div>
          )}

          {planoUrl && (
            <div className="mb-4 text-xs text-brand-blue bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 flex items-center gap-2">
              <Camera size={14} /> Botón &quot;Ver plano de planta&quot; disponible
            </div>
          )}

          {items.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              Todavía no hay ítems cargados — el técnico va a ver un aviso pidiendo que contactes al supervisor.
            </div>
          ) : campos.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              Este tipo todavía no tiene columnas de chequeo configuradas.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {itemsVisibles.map((item) => {
                const respuestasItem = respuestas[item.numero] ?? {}
                const camposConNovedad = campos.filter((c) => respuestaEsNovedad(c, respuestasItem[c.clave]))
                return (
                  <div key={item.numero} className="border border-gray-100 rounded-xl p-3">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="font-mono text-sm font-semibold text-brand-ink">{item.numero}</span>
                      {item.tipo_extintor && (
                        <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{item.tipo_extintor}</span>
                      )}
                      {item.ubicacion && (
                        <span className="text-xs text-gray-400">{item.ubicacion}</span>
                      )}
                    </div>
                    <div className="flex items-end gap-2 flex-wrap">
                      {campos.map((c) => {
                        const valor = respuestasItem[c.clave]
                        return (
                          <div key={c.clave} className="flex flex-col items-center gap-1">
                            <span className="text-[11px] text-gray-500">{c.etiqueta}</span>
                            {c.tipo_campo === 'select' ? (
                              <select
                                value={typeof valor === 'string' ? valor : ''}
                                onChange={(e) => setValor(item.numero, c.clave, e.target.value)}
                                className="min-h-[44px] border border-gray-300 rounded px-2 text-sm"
                              >
                                {(c.opciones ?? []).map((op) => <option key={op} value={op}>{op}</option>)}
                              </select>
                            ) : c.tipo_campo === 'texto' || c.tipo_campo === 'ubicacion' ? (
                              <input
                                type="text"
                                value={typeof valor === 'string' ? valor : ''}
                                onChange={(e) => setValor(item.numero, c.clave, e.target.value)}
                                className="min-h-[44px] border border-gray-300 rounded px-2 text-sm w-28"
                              />
                            ) : c.tipo_campo === 'fecha' ? (
                              <input
                                type="date"
                                value={typeof valor === 'string' ? valor : ''}
                                onChange={(e) => setValor(item.numero, c.clave, e.target.value)}
                                className="min-h-[44px] border border-gray-300 rounded px-2 text-sm"
                              />
                            ) : c.tipo_campo === 'numero' ? (
                              <input
                                type="number"
                                inputMode="decimal"
                                min={c.valor_min ?? undefined}
                                max={c.valor_max ?? undefined}
                                value={typeof valor === 'number' ? valor : ''}
                                onChange={(e) => setValor(item.numero, c.clave, e.target.valueAsNumber)}
                                className="min-h-[44px] border border-gray-300 rounded px-2 text-sm w-20"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => setValor(item.numero, c.clave, !(valor as boolean))}
                                className={`min-w-[44px] min-h-[44px] rounded font-bold text-sm transition-colors ${
                                  valor ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                                }`}
                              >
                                {valor ? 'SI' : 'NO'}
                              </button>
                            )}
                          </div>
                        )
                      })}
                      <button
                        type="button"
                        onClick={() => setFotoCargada((prev) => ({ ...prev, [item.numero]: !prev[item.numero] }))}
                        title="Simulación — no sube ninguna foto real"
                        className="flex items-center justify-center w-11 h-11 rounded-lg border border-dashed border-gray-300 text-gray-400 hover:bg-gray-50 ml-auto shrink-0"
                      >
                        {fotoCargada[item.numero] ? <CheckCircle size={18} className="text-green-600" /> : <Camera size={16} />}
                      </button>
                    </div>

                    {camposConNovedad.map((c) => (
                      <div key={c.clave} className="mt-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          {c.etiqueta} — observación <span className="text-red-500">(obligatorio)</span>
                        </label>
                        <textarea
                          value={observaciones[item.numero]?.[c.clave] ?? ''}
                          onChange={(e) => setObs(item.numero, c.clave, e.target.value)}
                          rows={2}
                          className="w-full border border-gray-300 rounded p-2 text-sm min-h-[44px]"
                        />
                      </div>
                    ))}
                  </div>
                )
              })}
              {restantes > 0 && (
                <p className="text-xs text-gray-400 text-center py-2">
                  + {restantes} ítem{restantes === 1 ? '' : 's'} más (no se muestran todos en la vista previa)
                </p>
              )}
            </div>
          )}

          {items.length > 0 && campos.length > 0 && (
            <>
              <div className="mt-5 pt-4 border-t border-gray-100">
                <p className="text-sm font-semibold text-brand-ink mb-2 flex items-center gap-1.5">
                  <PenLine size={14} /> Firma del técnico
                </p>
                <SignatureCanvas
                  onChange={() => {}}
                  onAclaracionChange={() => {}}
                  aclaracion="Juan Pérez — DNI 12.345.678"
                />
              </div>

              <button
                type="button"
                disabled
                title="Vista previa — no envía nada"
                className="w-full bg-brand-orange text-white font-bold py-4 rounded-lg text-base min-h-[56px] mt-5 opacity-60 cursor-not-allowed"
              >
                Enviar Planilla
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
