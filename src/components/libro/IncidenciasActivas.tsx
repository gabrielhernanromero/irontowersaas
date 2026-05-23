'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { Incidencia } from '@/types/database'
import IncidenciaDetailSheet from './IncidenciaDetailSheet'

const SEV_BADGE: Record<string, { label: string; cls: string }> = {
  alto:  { label: 'Alta',  cls: 'bg-red-100 text-red-800 border-red-300' },
  medio: { label: 'Media', cls: 'bg-orange-100 text-orange-800 border-orange-300' },
  bajo:  { label: 'Baja',  cls: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
}

function limpiarTitulo(titulo: string | null | undefined): string {
  if (!titulo) return ''
  const match = titulo.match(/^\[.*?\]\s*(?:-\s*)?(.*)$/)
  return match ? match[1].trim() : titulo
}

function limpiarDescripcion(descripcion: string | null | undefined): string {
  if (!descripcion) return ''
  const match = descripcion.match(/Detalle.*?:\s*["'](.+?)["']/i)
  return match ? match[1].trim() : descripcion
}

interface Props {
  incidencias: Incidencia[]
  turnoId?: string
}

export default function IncidenciasActivas({ incidencias, turnoId }: Props) {
  const [selected, setSelected] = useState<Incidencia | null>(null)
  const [resolved, setResolved] = useState<Set<string>>(new Set())

  const visibles = incidencias.filter((i) => !resolved.has(i.id))

  if (visibles.length === 0) return null

  return (
    <>
      <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={16} className="text-red-500 shrink-0" />
          <p className="text-sm font-bold text-red-700">
            {visibles.length === 1
              ? '1 incidencia activa en este puesto'
              : `${visibles.length} incidencias activas en este puesto`}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {visibles.map((inc) => {
            const sev   = inc.severidad ? SEV_BADGE[inc.severidad] : null
            const titulo = limpiarTitulo(inc.titulo)
            const desc   = limpiarDescripcion(inc.descripcion)

            return (
              <button
                key={inc.id}
                type="button"
                onClick={() => setSelected(inc)}
                className="bg-white rounded-lg border border-red-200 p-3 text-left w-full active:bg-red-50"
              >
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-sm font-semibold text-red-800 flex-1 min-w-0 truncate">
                    {titulo}
                  </span>
                  {sev && (
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded border shrink-0 ${sev.cls}`}>
                      {sev.label}
                    </span>
                  )}
                </div>
                {desc && <p className="text-xs text-red-700 line-clamp-2">{desc}</p>}
                <p className="text-xs text-red-400 mt-1">Tocá para ver detalle →</p>
              </button>
            )
          })}
        </div>
      </div>

      {selected && (
        <IncidenciaDetailSheet
          incidencia={selected}
          turnoId={turnoId}
          onClose={() => setSelected(null)}
          onResolved={(id) => {
            setResolved((prev) => new Set(Array.from(prev).concat(id)))
            setSelected(null)
          }}
        />
      )}
    </>
  )
}
