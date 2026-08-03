'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, Trash2, Plus } from 'lucide-react'

interface Feriado {
  id: string
  fecha: string
  nombre: string
  tipo: 'nacional' | 'puente'
}

export default function FeriadosClient({ feriados: inicial }: { feriados: Feriado[] }) {
  const [feriados, setFeriados] = useState(inicial)
  const [fecha, setFecha] = useState('')
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<'nacional' | 'puente'>('nacional')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function agregar() {
    if (!fecha || !nombre.trim()) { setError('Completá fecha y nombre'); return }
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/supervisor/feriados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, nombre: nombre.trim(), tipo }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al agregar el feriado'); return }
      setFeriados((prev) => [...prev, json.feriado].sort((a, b) => a.fecha.localeCompare(b.fecha)))
      setFecha('')
      setNombre('')
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  async function eliminar(id: string) {
    const anterior = feriados
    setFeriados((prev) => prev.filter((f) => f.id !== id))
    const res = await fetch(`/api/supervisor/feriados/${id}`, { method: 'DELETE' })
    if (!res.ok) setFeriados(anterior)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/supervisor/personal/horas" className="flex items-center gap-1 text-sm text-brand-orange mb-2 w-fit">
          <ArrowLeft size={16} /> Volver a horas trabajadas
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-orange/10 flex items-center justify-center">
            <CalendarDays size={22} className="text-brand-orange" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Feriados</h1>
            <p className="text-sm text-gray-500">Calendario usado para marcar turnos trabajados en feriado</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">
        <div className="w-full sm:w-auto">
          <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full sm:w-auto border border-gray-300 rounded-lg p-2 text-base min-h-[44px]" />
        </div>
        <div className="w-full sm:flex-1 sm:min-w-[10rem]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Día de la Independencia"
            className="w-full border border-gray-300 rounded-lg p-2 text-base min-h-[44px]"
          />
        </div>
        <div className="w-full sm:w-auto">
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as 'nacional' | 'puente')} className="w-full sm:w-auto border border-gray-300 rounded-lg p-2 text-base min-h-[44px]">
            <option value="nacional">Nacional</option>
            <option value="puente">Puente (turístico)</option>
          </select>
        </div>
        <button
          onClick={agregar}
          disabled={submitting}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-brand-orange text-white font-semibold px-4 py-2 rounded-lg text-base min-h-[44px] disabled:opacity-50"
        >
          <Plus size={16} /> Agregar
        </button>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
        {feriados.length === 0 && <p className="p-4 text-sm text-gray-500">Todavía no hay feriados cargados.</p>}
        {feriados.map((f) => (
          <div key={f.id} className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium text-gray-900">{f.fecha.split('-').reverse().join('/')} — {f.nombre}</p>
              <p className="text-xs text-gray-500">{f.tipo === 'nacional' ? 'Feriado nacional' : 'Feriado puente'}</p>
            </div>
            <button onClick={() => eliminar(f.id)} className="text-gray-400 hover:text-red-600 p-2 min-h-[44px] min-w-[44px]">
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
