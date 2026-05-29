'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, X, QrCode } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

interface Props { tecnicoId: string }

export default function RondaAlertBanner({ tecnicoId }: Props) {
  const router = useRouter()
  const [alerta, setAlerta] = useState<{ id: string; mensaje: string } | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const client = supabase()

    const channel = client
      .channel(`ronda-alerta-${tecnicoId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'alertas',
          filter: `destinatario_id=eq.${tecnicoId}`,
        },
        (payload) => {
          const nueva = payload.new as { id: string; tipo: string; mensaje: string }
          if (nueva.tipo === 'ronda_proxima') {
            setAlerta({ id: nueva.id, mensaje: nueva.mensaje })
            setVisible(true)
          }
        }
      )
      .subscribe()

    return () => { client.removeChannel(channel) }
  }, [tecnicoId])

  async function marcarLeida(id: string) {
    await fetch(`/api/alertas/${id}/read`, { method: 'PATCH' })
  }

  function dismiss() {
    if (alerta) marcarLeida(alerta.id)
    setVisible(false)
    setAlerta(null)
  }

  function irARondas() {
    if (alerta) marcarLeida(alerta.id)
    setVisible(false)
    router.push('/tecnico/ronda')
  }

  if (!visible || !alerta) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 animate-slide-down">
      <div className="max-w-[430px] mx-auto px-3 pt-3">
        <div className="bg-brand-ink text-white rounded-2xl shadow-2xl px-4 py-3.5 flex items-center gap-3">
          {/* Ícono animado */}
          <div className="relative shrink-0">
            <Bell size={22} className="text-brand-orange" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-brand-orange rounded-full">
              <span className="absolute inset-0 animate-ping rounded-full bg-brand-orange opacity-60" />
            </span>
          </div>

          {/* Mensaje */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold leading-tight">{alerta.mensaje}</p>
            <button
              onClick={irARondas}
              className="flex items-center gap-1 text-xs text-brand-orange font-semibold mt-0.5 hover:underline"
            >
              <QrCode size={11} />
              Ir a iniciar ronda
            </button>
          </div>

          {/* Cerrar */}
          <button
            onClick={dismiss}
            className="p-1 text-white/60 hover:text-white shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
