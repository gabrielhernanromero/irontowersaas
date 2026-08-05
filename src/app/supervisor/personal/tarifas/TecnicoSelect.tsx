'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

interface TecnicoOption {
  id: string
  nombre: string
  apellido: string
  clientes: { nombre_empresa: string } | null
}

function agruparPorSede(tecnicos: TecnicoOption[]): { sede: string; tecnicos: TecnicoOption[] }[] {
  const grupos = new Map<string, TecnicoOption[]>()
  for (const t of tecnicos) {
    const sede = t.clientes?.nombre_empresa ?? 'Sin sede asignada'
    grupos.set(sede, [...(grupos.get(sede) ?? []), t])
  }
  return Array.from(grupos.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sede, tecnicos]) => ({ sede, tecnicos }))
}

// Dropdown con estilo propio (no el <select> nativo) para elegir un
// técnico, agrupado por sede. No hay ningún combobox reutilizable en el
// proyecto todavía — este queda acotado a esta pantalla.
export default function TecnicoSelect({
  tecnicos, value, onChange,
}: {
  tecnicos: TecnicoOption[]
  value: string
  onChange: (id: string) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [haciaArriba, setHaciaArriba] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const ALTO_MAXIMO_PANEL = 288 // debe coincidir con max-h-72 (18rem) de abajo

  useEffect(() => {
    function onClickFuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', onClickFuera)
    return () => document.removeEventListener('mousedown', onClickFuera)
  }, [])

  function toggleAbierto() {
    if (!abierto && ref.current) {
      const espacioAbajo = window.innerHeight - ref.current.getBoundingClientRect().bottom
      setHaciaArriba(espacioAbajo < ALTO_MAXIMO_PANEL)
    }
    setAbierto((v) => !v)
  }

  const seleccionado = tecnicos.find((t) => t.id === value)

  return (
    <div ref={ref} className="relative w-full sm:w-auto">
      <button
        type="button"
        onClick={toggleAbierto}
        className="w-full sm:w-56 flex items-center justify-between gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2 text-base min-h-[44px]"
      >
        <span className={seleccionado ? 'text-gray-900' : 'text-gray-400'}>
          {seleccionado ? `${seleccionado.nombre} ${seleccionado.apellido}` : 'Elegir técnico…'}
        </span>
        <ChevronDown size={16} className="text-gray-400 shrink-0" />
      </button>

      {abierto && (
        <div className={`absolute z-10 w-full sm:w-72 max-h-72 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg py-1 ${
          haciaArriba ? 'bottom-full mb-1' : 'top-full mt-1'
        }`}>
          {agruparPorSede(tecnicos).map((grupo) => (
            <div key={grupo.sede}>
              <p className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">{grupo.sede}</p>
              {grupo.tecnicos.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { onChange(t.id); setAbierto(false) }}
                  className={`w-full text-left px-3 py-2 min-h-[44px] text-base hover:bg-gray-50 ${
                    t.id === value ? 'bg-orange-50 text-brand-orange font-medium' : 'text-gray-700'
                  }`}
                >
                  {t.nombre} {t.apellido}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
