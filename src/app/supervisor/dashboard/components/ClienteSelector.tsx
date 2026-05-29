'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, X, Building2 } from 'lucide-react'

interface Cliente { id: string; nombre_empresa: string }

interface Props {
  clientes: Cliente[]
  value: string | null          // null = todos
  onChange: (id: string | null) => void
}

export default function ClienteSelector({ clientes, value, onChange }: Props) {
  const [open,   setOpen]   = useState(false)
  const [query,  setQuery]  = useState('')
  const ref                 = useRef<HTMLDivElement>(null)

  const selected = clientes.find(c => c.id === value) ?? null

  const filtered = query.trim()
    ? clientes.filter(c =>
        c.nombre_empresa.toLowerCase().includes(query.toLowerCase())
      )
    : clientes

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function select(id: string | null) {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-700 hover:border-gray-300 transition-colors shadow-sm min-w-[200px] justify-between"
      >
        <span className="flex items-center gap-2 truncate">
          <Building2 size={14} className="text-gray-400 shrink-0" />
          <span className="truncate">
            {selected ? selected.nombre_empresa : 'Todos los clientes'}
          </span>
        </span>
        <div className="flex items-center gap-1 shrink-0 ml-1">
          {selected && (
            <span
              onClick={e => { e.stopPropagation(); select(null) }}
              className="p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          {/* Search */}
          {clientes.length > 5 && (
            <div className="p-2 border-b border-gray-100">
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <Search size={13} className="text-gray-400 shrink-0" />
                <input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar cliente..."
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
                />
              </div>
            </div>
          )}

          {/* Options */}
          <div className="max-h-60 overflow-y-auto">
            {/* All option */}
            <button
              onClick={() => select(null)}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors ${
                value === null ? 'text-brand-orange font-semibold bg-brand-orange/5' : 'text-gray-700'
              }`}
            >
              <span className="w-5 h-5 rounded-md bg-gray-100 flex items-center justify-center shrink-0">
                <Building2 size={11} className="text-gray-500" />
              </span>
              Todos los clientes
            </button>

            <div className="h-px bg-gray-100 mx-3" />

            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-400 italic">Sin resultados</p>
            ) : (
              filtered.map(c => (
                <button
                  key={c.id}
                  onClick={() => select(c.id)}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors ${
                    value === c.id ? 'text-brand-orange font-semibold bg-brand-orange/5' : 'text-gray-700'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-xs font-bold ${
                    value === c.id ? 'bg-brand-orange text-white' : 'bg-brand-ink text-white'
                  }`}>
                    {c.nombre_empresa[0].toUpperCase()}
                  </span>
                  {c.nombre_empresa}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
