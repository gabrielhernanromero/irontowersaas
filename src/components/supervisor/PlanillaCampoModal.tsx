'use client'

import { useState } from 'react'
import { X, Plus, Trash2, Check, CheckSquare, List, Type, Hash, Calendar, MapPin } from 'lucide-react'
import type { PlanillaTipoCampo, TipoCampo } from '@/types/database'

const TIPOS: { valor: TipoCampo; etiqueta: string; icono: typeof CheckSquare }[] = [
  { valor: 'check', etiqueta: 'Check OK/NO', icono: CheckSquare },
  { valor: 'select', etiqueta: 'Selección', icono: List },
  { valor: 'texto', etiqueta: 'Texto libre', icono: Type },
  { valor: 'numero', etiqueta: 'Numérico', icono: Hash },
  { valor: 'fecha', etiqueta: 'Fecha', icono: Calendar },
  { valor: 'ubicacion', etiqueta: 'Ubicación', icono: MapPin },
]

interface Props {
  planillaTipoId: string
  campo: PlanillaTipoCampo | null // null = crear, si no = editar
  ordenSiguiente: number
  onClose: () => void
  onSaved: (campo: PlanillaTipoCampo) => void
}

export default function PlanillaCampoModal({ planillaTipoId, campo, ordenSiguiente, onClose, onSaved }: Props) {
  const editando = campo !== null
  const [etiqueta, setEtiqueta] = useState(campo?.etiqueta ?? '')
  const [tipoCampo, setTipoCampo] = useState<TipoCampo>(campo?.tipo_campo ?? 'check')
  const [opciones, setOpciones] = useState<string[]>(campo?.opciones ?? [])
  const [nuevaOpcion, setNuevaOpcion] = useState('')
  const [min, setMin] = useState(campo?.valor_min?.toString() ?? '')
  const [max, setMax] = useState(campo?.valor_max?.toString() ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function agregarOpcion() {
    const valor = nuevaOpcion.trim()
    if (!valor || opciones.includes(valor)) { setNuevaOpcion(''); return }
    setOpciones(prev => [...prev, valor])
    setNuevaOpcion('')
  }

  function quitarOpcion(valor: string) {
    setOpciones(prev => prev.filter(o => o !== valor))
  }

  async function guardar() {
    if (!etiqueta.trim()) { setError('Ponele un nombre al campo'); return }
    const valorMin = min.trim() === '' ? null : Number(min)
    const valorMax = max.trim() === '' ? null : Number(max)
    if (tipoCampo === 'numero' && valorMin != null && valorMax != null && valorMin > valorMax) {
      setError('El mínimo no puede ser mayor que el máximo')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const extra =
        tipoCampo === 'select' ? { opciones } :
        tipoCampo === 'numero' ? { valor_min: valorMin, valor_max: valorMax } :
        {}
      const res = editando
        ? await fetch('/api/supervisor/planilla-tipo-campos', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: campo.id, etiqueta: etiqueta.trim(), ...extra }),
          })
        : await fetch('/api/supervisor/planilla-tipo-campos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              planilla_tipo_id: planillaTipoId,
              etiqueta: etiqueta.trim(),
              orden: ordenSiguiente,
              tipo_campo: tipoCampo,
              ...extra,
            }),
          })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al guardar'); return }
      onSaved(json.campo)
      onClose()
    } catch { setError('Error de conexión') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-xs font-semibold text-brand-orange uppercase tracking-wide">
              {editando ? 'Editar campo' : 'Nuevo campo'}
            </p>
            <h2 className="text-base font-bold text-brand-ink">{editando ? campo.etiqueta : 'Columna nueva'}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 min-h-[44px] min-w-[44px] text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4">
          {error && (
            <div className="mb-3 text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg p-2">{error}</div>
          )}

          <label className="block text-xs text-gray-500 mb-1">Nombre del campo</label>
          <input
            autoFocus
            value={etiqueta}
            onChange={e => setEtiqueta(e.target.value)}
            placeholder="Ej: Presión, Marca, Vencimiento..."
            disabled={saving}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[44px] mb-4"
          />

          <label className="block text-xs text-gray-500 mb-1.5">Tipo de campo</label>
          <div className={`flex flex-col gap-1 mb-1 ${editando ? 'opacity-60' : ''}`}>
            {TIPOS.map(t => {
              const Icono = t.icono
              const seleccionado = tipoCampo === t.valor
              return (
                <button
                  key={t.valor}
                  type="button"
                  disabled={editando || saving}
                  onClick={() => setTipoCampo(t.valor)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left min-h-[44px] border transition-colors ${
                    seleccionado
                      ? 'border-brand-orange bg-brand-orange/5 text-brand-ink font-semibold'
                      : 'border-transparent text-gray-600 hover:bg-gray-50'
                  } ${editando ? 'cursor-not-allowed' : ''}`}
                >
                  <Icono size={15} className={seleccionado ? 'text-brand-orange' : 'text-gray-400'} />
                  {t.etiqueta}
                  {seleccionado && <Check size={15} className="text-brand-orange ml-auto" />}
                </button>
              )
            })}
          </div>
          {editando && (
            <p className="text-xs text-gray-400 mb-4">El tipo no se puede cambiar después de creado.</p>
          )}

          {tipoCampo === 'select' && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2">Opciones que va a poder elegir el técnico</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {opciones.length === 0 && (
                  <p className="text-sm text-gray-400 italic">Sin opciones todavía.</p>
                )}
                {opciones.map(op => (
                  <span key={op} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5 text-sm text-brand-ink">
                    {op}
                    <button onClick={() => quitarOpcion(op)} disabled={saving} className="text-gray-300 hover:text-red-500 disabled:opacity-50">
                      <Trash2 size={11} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={nuevaOpcion}
                  onChange={e => setNuevaOpcion(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregarOpcion() } }}
                  placeholder="Nueva opción..."
                  disabled={saving}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[44px] flex-1"
                />
                <button
                  onClick={agregarOpcion}
                  disabled={saving}
                  className="bg-gray-100 text-gray-600 text-sm font-semibold px-3 py-2 rounded-lg min-h-[44px] disabled:opacity-60"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          )}

          {tipoCampo === 'numero' && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2">
                Rango esperado — fuera de este rango se va a pedir observación obligatoria y se va a
                alertar a los supervisores, igual que un chequeo en NO. Dejalo vacío para no limitarlo.
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Mínimo</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={min}
                    onChange={e => setMin(e.target.value)}
                    disabled={saving}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[44px]"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Máximo</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={max}
                    onChange={e => setMax(e.target.value)}
                    disabled={saving}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[44px]"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 mt-5">
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 border border-gray-300 text-gray-600 text-sm font-semibold px-3 py-2.5 rounded-lg min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={saving}
              className="flex-1 bg-brand-orange text-white text-sm font-semibold px-3 py-2.5 rounded-lg min-h-[44px] disabled:opacity-60"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
