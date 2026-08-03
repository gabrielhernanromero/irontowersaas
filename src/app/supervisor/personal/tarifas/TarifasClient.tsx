'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Settings, Trash2, Plus } from 'lucide-react'

type TipoTarifa = 'diurno' | 'nocturno' | 'feriado_nacional' | 'feriado_puente'

export interface TarifaRow {
  id: string
  tecnico_id: string | null
  tipo: TipoTarifa
  valor: number
  users: { nombre: string; apellido: string } | null
}

export interface TecnicoRow { id: string; nombre: string; apellido: string }

const TIPOS: { valor: TipoTarifa; label: string }[] = [
  { valor: 'diurno', label: 'Diurno' },
  { valor: 'nocturno', label: 'Nocturno' },
  { valor: 'feriado_nacional', label: 'Feriado nacional' },
  { valor: 'feriado_puente', label: 'Feriado puente' },
]

export default function TarifasClient({ tarifas: inicial, tecnicos }: { tarifas: TarifaRow[]; tecnicos: TecnicoRow[] }) {
  const [tarifas, setTarifas] = useState(inicial)
  const [error, setError] = useState<string | null>(null)

  const [baseInputs, setBaseInputs] = useState<Record<TipoTarifa, string>>(() => {
    const m = {} as Record<TipoTarifa, string>
    for (const t of TIPOS) {
      const existente = inicial.find((x) => x.tipo === t.valor && x.tecnico_id === null)
      m[t.valor] = existente ? String(existente.valor) : ''
    }
    return m
  })

  const [overrideTecnico, setOverrideTecnico] = useState('')
  const [overrideTipo, setOverrideTipo] = useState<TipoTarifa>('diurno')
  const [overrideValor, setOverrideValor] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const overrides = tarifas.filter((t) => t.tecnico_id !== null)

  async function guardarBase(tipo: TipoTarifa) {
    const valor = Number(baseInputs[tipo])
    if (Number.isNaN(valor) || valor < 0) { setError('Valor inválido'); return }
    setError(null)
    const res = await fetch('/api/supervisor/tarifas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, valor }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Error al guardar'); return }
    setTarifas((prev) => [...prev.filter((t) => !(t.tipo === tipo && t.tecnico_id === null)), { ...json.tarifa, users: null }])
  }

  async function agregarOverride() {
    if (!overrideTecnico) { setError('Elegí un técnico'); return }
    const valor = Number(overrideValor)
    if (Number.isNaN(valor) || valor < 0) { setError('Valor inválido'); return }
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/supervisor/tarifas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: overrideTipo, valor, tecnicoId: overrideTecnico }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al guardar'); return }
      const tecnico = tecnicos.find((t) => t.id === overrideTecnico)
      setTarifas((prev) => [
        ...prev.filter((t) => !(t.tipo === overrideTipo && t.tecnico_id === overrideTecnico)),
        { ...json.tarifa, users: tecnico ? { nombre: tecnico.nombre, apellido: tecnico.apellido } : null },
      ])
      setOverrideValor('')
    } finally {
      setSubmitting(false)
    }
  }

  async function eliminarOverride(id: string) {
    const anterior = tarifas
    setTarifas((prev) => prev.filter((t) => t.id !== id))
    const res = await fetch(`/api/supervisor/tarifas/${id}`, { method: 'DELETE' })
    if (!res.ok) setTarifas(anterior)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/supervisor/personal/horas" className="flex items-center gap-1 text-sm text-brand-orange mb-2 w-fit">
          <ArrowLeft size={16} /> Volver a horas trabajadas
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-orange/10 flex items-center justify-center">
            <Settings size={22} className="text-brand-orange" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tarifas por turno</h1>
            <p className="text-sm text-gray-500">
              Opcional: si no cargás nada acá, el reporte de horas trabajadas sigue funcionando igual, solo sin columna de $.
            </p>
          </div>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {/* Tarifas base */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <h2 className="font-semibold text-gray-900 mb-3">Tarifa base (aplica a todos los técnicos)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TIPOS.map((t) => (
            <div key={t.valor} className="flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="text-sm text-gray-600 sm:w-36">{t.label}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={baseInputs[t.valor]}
                  onChange={(e) => setBaseInputs((prev) => ({ ...prev, [t.valor]: e.target.value }))}
                  className="border border-gray-300 rounded-lg p-2 text-base min-h-[44px] w-32"
                  placeholder="Sin cargar"
                />
                <button onClick={() => guardarBase(t.valor)} className="text-base text-brand-orange px-2 min-h-[44px]">Guardar</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Overrides por técnico */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <h2 className="font-semibold text-gray-900 mb-3">Excepción por técnico</h2>
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 mb-4">
          <div className="w-full sm:w-auto">
            <label className="block text-xs font-medium text-gray-600 mb-1">Técnico</label>
            <select value={overrideTecnico} onChange={(e) => setOverrideTecnico(e.target.value)} className="w-full sm:w-auto sm:min-w-[10rem] border border-gray-300 rounded-lg p-2 text-base min-h-[44px]">
              <option value="">Elegir…</option>
              {tecnicos.map((t) => <option key={t.id} value={t.id}>{t.nombre} {t.apellido}</option>)}
            </select>
          </div>
          <div className="w-full sm:w-auto">
            <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de turno</label>
            <select value={overrideTipo} onChange={(e) => setOverrideTipo(e.target.value as TipoTarifa)} className="w-full sm:w-auto border border-gray-300 rounded-lg p-2 text-base min-h-[44px]">
              {TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.label}</option>)}
            </select>
          </div>
          <div className="w-full sm:w-auto">
            <label className="block text-xs font-medium text-gray-600 mb-1">Valor</label>
            <input type="number" min={0} value={overrideValor} onChange={(e) => setOverrideValor(e.target.value)} className="w-full sm:w-32 border border-gray-300 rounded-lg p-2 text-base min-h-[44px]" />
          </div>
          <button
            onClick={agregarOverride}
            disabled={submitting}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-brand-orange text-white font-semibold px-4 py-2 rounded-lg text-base min-h-[44px] disabled:opacity-50"
          >
            <Plus size={16} /> Agregar
          </button>
        </div>

        <div className="divide-y divide-gray-100">
          {overrides.length === 0 && <p className="text-sm text-gray-500">Sin excepciones cargadas.</p>}
          {overrides.map((o) => (
            <div key={o.id} className="flex items-center justify-between py-3">
              <p className="text-sm text-gray-900">
                {o.users ? `${o.users.nombre} ${o.users.apellido}` : 'Técnico'} — {TIPOS.find((t) => t.valor === o.tipo)?.label}: <span className="font-medium">${o.valor}</span>
              </p>
              <button onClick={() => eliminarOverride(o.id)} className="text-gray-400 hover:text-red-600 p-2 min-h-[44px] min-w-[44px]">
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
