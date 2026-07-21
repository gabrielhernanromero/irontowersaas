'use client'

import { X, ClipboardCheck, MapPin, User, Clock, CheckCircle2 } from 'lucide-react'

interface RondaDetalle {
  id: string
  numero_ronda: number
  completa: boolean
  total_puntos: number
  puntos_escaneados: number
  hora_inicio: string
  hora_fin: string | null
  clientes: { id: string; nombre_empresa: string } | null
  tecnico: { nombre: string; apellido: string } | null
}

interface Props {
  rondas: RondaDetalle[]
  onClose: () => void
}

export default function RondasSheet({ rondas, onClose }: Props) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />

      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ClipboardCheck size={18} className="text-brand-orange" />
            <span className="font-bold text-brand-ink">Rondas de hoy</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {rondas.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Todavía no se registraron rondas hoy.</p>
          ) : (
            <div className="space-y-3">
              {rondas.map(r => (
                <div key={r.id} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-brand-ink">Ronda #{r.numero_ronda}</span>
                    <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                      r.completa ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {r.completa && <CheckCircle2 size={11} />}
                      {r.puntos_escaneados}/{r.total_puntos} puntos
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {r.tecnico && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <User size={12} className="text-gray-400 shrink-0" />
                        {r.tecnico.nombre} {r.tecnico.apellido}
                      </div>
                    )}
                    {r.clientes && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <MapPin size={12} className="text-gray-400 shrink-0" />
                        {r.clientes.nombre_empresa}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock size={12} className="text-gray-400 shrink-0" />
                      {new Date(r.hora_inicio).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      {r.hora_fin && ` → ${new Date(r.hora_fin).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
