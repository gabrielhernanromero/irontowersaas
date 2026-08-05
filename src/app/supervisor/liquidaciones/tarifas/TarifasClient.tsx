'use client'

import { useState } from 'react'
import { Trash2, Plus, Check } from 'lucide-react'
import TecnicoSelect from './TecnicoSelect'

type TipoTarifa = 'diurno' | 'nocturno' | 'feriado_nacional' | 'feriado_puente'

export interface TarifaRow {
  id: string
  tecnico_id: string | null
  tipo: TipoTarifa | null // null en las excepciones de técnico: precio único, sin tipo
  valor: number
  vigente_desde: string
  users: { nombre: string; apellido: string } | null
}

export interface TecnicoRow {
  id: string
  nombre: string
  apellido: string
  clientes: { nombre_empresa: string } | null
}

// Puede haber varias filas por tipo/técnico (una por vigencia) — la
// "actual" es la de vigente_desde más reciente.
function masReciente(filas: TarifaRow[]): TarifaRow | undefined {
  return filas.reduce<TarifaRow | undefined>(
    (actual, f) => (!actual || f.vigente_desde > actual.vigente_desde ? f : actual),
    undefined,
  )
}

function Guardado() {
  return (
    <span className="flex items-center gap-1 text-green-600 text-sm">
      <Check size={16} /> Guardado
    </span>
  )
}

export default function TarifasClient({ tarifas: inicial, tecnicos }: { tarifas: TarifaRow[]; tecnicos: TecnicoRow[] }) {
  const [tarifas, setTarifas] = useState(inicial)
  const [error, setError] = useState<string | null>(null)

  const base = (tipo: TipoTarifa) => masReciente(tarifas.filter((t) => t.tipo === tipo && t.tecnico_id === null))

  const [general, setGeneral] = useState(String(base('diurno')?.valor ?? ''))
  const [nocturnoActivo, setNocturnoActivo] = useState(!!base('nocturno'))
  const [nocturno, setNocturno] = useState(String(base('nocturno')?.valor ?? ''))
  const [feriadoActivo, setFeriadoActivo] = useState(!!base('feriado_nacional') || !!base('feriado_puente'))
  const [feriadoNacional, setFeriadoNacional] = useState(String(base('feriado_nacional')?.valor ?? ''))
  const [feriadoPuente, setFeriadoPuente] = useState(String(base('feriado_puente')?.valor ?? ''))

  const [overrideTecnico, setOverrideTecnico] = useState('')
  const [overrideValor, setOverrideValor] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [guardadoTipo, setGuardadoTipo] = useState<TipoTarifa | null>(null)

  // Solo la excepción vigente por técnico (un precio único por persona).
  const overrides = (() => {
    const grupos = new Map<string, TarifaRow[]>()
    for (const t of tarifas) {
      if (!t.tecnico_id) continue
      grupos.set(t.tecnico_id, [...(grupos.get(t.tecnico_id) ?? []), t])
    }
    return Array.from(grupos.values()).map((filas) => masReciente(filas)!)
  })()

  async function guardarBase(tipo: TipoTarifa, valorTexto: string) {
    if (valorTexto.trim() === '') { setError('Ingresá un valor'); return }
    const valor = Number(valorTexto)
    if (Number.isNaN(valor) || valor < 0) { setError('Valor inválido'); return }
    setError(null)
    const res = await fetch('/api/supervisor/tarifas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, valor }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Error al guardar'); return }
    setTarifas((prev) => [
      ...prev.filter((t) => !(t.tipo === tipo && t.tecnico_id === null && t.vigente_desde === json.tarifa.vigente_desde)),
      { ...json.tarifa, users: null },
    ])
    setGuardadoTipo(tipo)
    setTimeout(() => setGuardadoTipo((actual) => (actual === tipo ? null : actual)), 2000)
  }

  async function borrarBase(tipo: TipoTarifa) {
    const fila = base(tipo)
    if (!fila) return
    const anterior = tarifas
    setTarifas((prev) => prev.filter((t) => t.id !== fila.id))
    const res = await fetch(`/api/supervisor/tarifas/${fila.id}`, { method: 'DELETE' })
    if (!res.ok) setTarifas(anterior)
  }

  function toggleNocturno(activo: boolean) {
    setNocturnoActivo(activo)
    if (!activo) { borrarBase('nocturno'); setNocturno('') }
  }

  function toggleFeriado(activo: boolean) {
    setFeriadoActivo(activo)
    if (!activo) {
      borrarBase('feriado_nacional')
      borrarBase('feriado_puente')
      setFeriadoNacional('')
      setFeriadoPuente('')
    }
  }

  async function agregarOverride() {
    if (!overrideTecnico) { setError('Elegí un técnico'); return }
    if (overrideValor.trim() === '') { setError('Ingresá un valor'); return }
    const valor = Number(overrideValor)
    if (Number.isNaN(valor) || valor < 0) { setError('Valor inválido'); return }
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/supervisor/tarifas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor, tecnicoId: overrideTecnico }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al guardar'); return }
      const tecnico = tecnicos.find((t) => t.id === overrideTecnico)
      setTarifas((prev) => [
        ...prev.filter((t) => !(t.tecnico_id === overrideTecnico && t.vigente_desde === json.tarifa.vigente_desde)),
        { ...json.tarifa, users: tecnico ? { nombre: tecnico.nombre, apellido: tecnico.apellido } : null },
      ])
      setOverrideValor('')
      setOverrideTecnico('')
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
      <p className="text-sm text-gray-500">
        Opcional: si no cargás nada acá, el reporte de horas trabajadas sigue funcionando igual, solo sin columna de $.
      </p>

      {error && <p className="text-red-600 text-base">{error}</p>}

      {/* Precio general */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-4">
        <div>
          <h2 className="font-semibold text-gray-900 mb-1">Precio general por turno</h2>
          <p className="text-sm text-gray-500 mb-3">Se usa para todos los turnos, salvo que actives una excepción abajo.</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={general}
              onChange={(e) => setGeneral(e.target.value)}
              placeholder="Ej: 15000"
              className="border border-gray-300 rounded-lg p-2 text-base min-h-[44px] w-40"
            />
            <button onClick={() => guardarBase('diurno', general)} className="text-base text-brand-orange px-2 min-h-[44px]">Guardar</button>
            {guardadoTipo === 'diurno' && <Guardado />}
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Nocturno */}
        <div>
          <label className="flex items-center gap-2 text-sm text-gray-700 mb-2 min-h-[44px]">
            <input type="checkbox" checked={nocturnoActivo} onChange={(e) => toggleNocturno(e.target.checked)} className="w-5 h-5" />
            ¿El turno nocturno vale distinto?
          </label>
          {nocturnoActivo && (
            <div className="flex items-center gap-2 ml-7">
              <input
                type="number"
                min={0}
                value={nocturno}
                onChange={(e) => setNocturno(e.target.value)}
                placeholder="Ej: 18000"
                className="border border-gray-300 rounded-lg p-2 text-base min-h-[44px] w-40"
              />
              <button onClick={() => guardarBase('nocturno', nocturno)} className="text-base text-brand-orange px-2 min-h-[44px]">Guardar</button>
              {guardadoTipo === 'nocturno' && <Guardado />}
            </div>
          )}
        </div>

        {/* Feriados */}
        <div>
          <label className="flex items-center gap-2 text-sm text-gray-700 mb-2 min-h-[44px]">
            <input type="checkbox" checked={feriadoActivo} onChange={(e) => toggleFeriado(e.target.checked)} className="w-5 h-5" />
            ¿Los feriados valen distinto?
          </label>
          {feriadoActivo && (
            <div className="ml-7 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 w-32">Feriado nacional</span>
                <input
                  type="number"
                  min={0}
                  value={feriadoNacional}
                  onChange={(e) => setFeriadoNacional(e.target.value)}
                  placeholder="Ej: 25000"
                  className="border border-gray-300 rounded-lg p-2 text-base min-h-[44px] w-40"
                />
                <button onClick={() => guardarBase('feriado_nacional', feriadoNacional)} className="text-base text-brand-orange px-2 min-h-[44px]">Guardar</button>
                {guardadoTipo === 'feriado_nacional' && <Guardado />}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 w-32">Feriado puente</span>
                <input
                  type="number"
                  min={0}
                  value={feriadoPuente}
                  onChange={(e) => setFeriadoPuente(e.target.value)}
                  placeholder="Ej: 20000"
                  className="border border-gray-300 rounded-lg p-2 text-base min-h-[44px] w-40"
                />
                <button onClick={() => guardarBase('feriado_puente', feriadoPuente)} className="text-base text-brand-orange px-2 min-h-[44px]">Guardar</button>
                {guardadoTipo === 'feriado_puente' && <Guardado />}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Overrides por técnico */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <h2 className="font-semibold text-gray-900 mb-1">¿Algún técnico cobra distinto?</h2>
        <p className="text-sm text-gray-500 mb-3">Un precio único para esa persona — reemplaza al precio general en cualquier turno suyo.</p>
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 mb-4">
          <div className="w-full sm:w-auto">
            <label className="block text-xs font-medium text-gray-600 mb-1">Técnico</label>
            <TecnicoSelect tecnicos={tecnicos} value={overrideTecnico} onChange={setOverrideTecnico} />
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
                {o.users ? `${o.users.nombre} ${o.users.apellido}` : 'Técnico'}: <span className="font-medium">${o.valor}</span> por turno
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
