'use client'

import { useState } from 'react'
import Link from 'next/link'
import { X, MapPin, User, Calendar, Clock, FileText, AlertTriangle } from 'lucide-react'
import { FotoThumb } from '@/components/ui/FotoLightbox'
import FotoLightbox from './FotoLightbox'
import { parsearCategoria, estadoActividad } from '../DashboardClient'

interface NovedadFeed {
  id: string
  turno_id: string
  tipo: string
  hora: string
  descripcion: string
  incidencia_id: string | null
  planilla_id: string | null
  foto_url: string | null
  created_at: string
  libro_turno: {
    id: string
    tecnico_nombre: string
    cliente_id: string | null
    clientes: { id: string; nombre_empresa: string } | null
  } | null
}

interface Props {
  novedad: NovedadFeed
  onClose: () => void
  onVerIncidencia: (incidenciaId: string) => void
}

export default function NovedadSheet({ novedad, onClose, onVerIncidencia }: Props) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const cat    = parsearCategoria(novedad.descripcion, novedad.tipo)
  const estado = estadoActividad(novedad.tipo)
  const detalle = novedad.descripcion.replace(/^\[[^\]]+\]\s*/, '')
  const fecha = new Date(novedad.created_at).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />

      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-brand-orange" />
            <span className="font-bold text-brand-ink">Actividad</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Categoría + estado */}
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${cat.cls}`}>{cat.label}</span>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${estado.dot}`} />
            <span className={`text-xs font-bold tracking-wide ${estado.cls}`}>{estado.label}</span>
          </div>

          {/* Detalle */}
          <p className="text-base text-gray-800 leading-relaxed">{detalle || novedad.descripcion}</p>

          {/* Foto adjunta */}
          {novedad.foto_url && (
            <FotoThumb url={novedad.foto_url} onClick={() => setLightboxUrl(novedad.foto_url!)} className="w-full h-48" />
          )}

          {/* Meta info */}
          <div className="space-y-2.5">
            {novedad.libro_turno?.tecnico_nombre && (
              <div className="flex items-center gap-2.5 text-sm text-gray-600">
                <User size={14} className="text-gray-400 shrink-0" />
                {novedad.libro_turno.tecnico_nombre}
              </div>
            )}
            {novedad.libro_turno?.clientes && (
              <div className="flex items-center gap-2.5 text-sm text-gray-600">
                <MapPin size={14} className="text-gray-400 shrink-0" />
                {novedad.libro_turno.clientes.nombre_empresa}
              </div>
            )}
            <div className="flex items-center gap-2.5 text-sm text-gray-500">
              <Calendar size={14} className="text-gray-400 shrink-0" />
              {fecha}
            </div>
            <div className="flex items-center gap-2.5 text-sm text-gray-500">
              <Clock size={14} className="text-gray-400 shrink-0" />
              {novedad.hora}
            </div>
          </div>

          {/* Navegación a registros relacionados */}
          {(novedad.planilla_id || novedad.incidencia_id) && (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              {novedad.planilla_id && (
                <Link
                  href={`/supervisor/planillas/${novedad.planilla_id}`}
                  className="flex items-center justify-center gap-2 w-full bg-brand-ink hover:bg-brand-ink/90 text-white font-semibold px-4 py-3 rounded-xl text-sm transition-colors min-h-[48px]"
                >
                  <FileText size={15} />
                  Ver planilla completa
                </Link>
              )}
              {novedad.incidencia_id && (
                <button
                  onClick={() => onVerIncidencia(novedad.incidencia_id!)}
                  className="flex items-center justify-center gap-2 w-full bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-semibold px-4 py-3 rounded-xl text-sm transition-colors min-h-[48px]"
                >
                  <AlertTriangle size={15} />
                  Ver incidencia
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {lightboxUrl && <FotoLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
    </>
  )
}
