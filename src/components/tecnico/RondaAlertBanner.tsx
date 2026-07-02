'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Bell, QrCode, ShieldAlert, X } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

interface Props { tecnicoId: string }

type TipoBanner = 'ronda_proxima' | 'ronda_vencida' | 'ausencia_encargado'

interface AlertaBanner {
  id: string
  tipo: TipoBanner
  mensaje: string
}

// Prioridad: vencida > ausencia_encargado > proxima
function prioridad(t: TipoBanner): number {
  if (t === 'ronda_vencida')       return 3
  if (t === 'ausencia_encargado')  return 2
  return 1
}

export default function RondaAlertBanner({ tecnicoId }: Props) {
  const router = useRouter()
  const [alertaProxima,   setAlertaProxima]   = useState<AlertaBanner | null>(null)
  const [alertaVencida,   setAlertaVencida]   = useState<AlertaBanner | null>(null)
  const [alertaAusencia,  setAlertaAusencia]  = useState<AlertaBanner | null>(null)

  useEffect(() => {
    const client = supabase()

    // Cargar alertas no leídas existentes al montar (para cuando el cron disparó antes de que el técnico abriera la app)
    client
      .from('alertas')
      .select('id, tipo, mensaje')
      .eq('destinatario_id', tecnicoId)
      .eq('leida', false)
      .in('tipo', ['ronda_proxima', 'ronda_vencida', 'ausencia_encargado'])
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        for (const a of (data ?? [])) {
          const alerta = { id: a.id, tipo: a.tipo as TipoBanner, mensaje: a.mensaje }
          if (a.tipo === 'ronda_proxima')      setAlertaProxima(prev => prev ?? alerta)
          else if (a.tipo === 'ronda_vencida') setAlertaVencida(prev => prev ?? alerta)
          else if (a.tipo === 'ausencia_encargado') setAlertaAusencia(prev => prev ?? alerta)
        }
      })

    const channel = client
      .channel(`tecnico-alerta-${tecnicoId}`)
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
            setAlertaProxima({ id: nueva.id, tipo: 'ronda_proxima', mensaje: nueva.mensaje })
          } else if (nueva.tipo === 'ronda_vencida') {
            setAlertaVencida({ id: nueva.id, tipo: 'ronda_vencida', mensaje: nueva.mensaje })
          } else if (nueva.tipo === 'ausencia_encargado') {
            setAlertaAusencia({ id: nueva.id, tipo: 'ausencia_encargado', mensaje: nueva.mensaje })
          }
        }
      )
      .subscribe()

    return () => { client.removeChannel(channel) }
  }, [tecnicoId])

  async function marcarLeida(id: string) {
    await fetch(`/api/alertas/${id}/read`, { method: 'PATCH' })
  }

  function dismiss(alerta: AlertaBanner) {
    marcarLeida(alerta.id)
    if (alerta.tipo === 'ronda_proxima')      setAlertaProxima(null)
    if (alerta.tipo === 'ronda_vencida')      setAlertaVencida(null)
    if (alerta.tipo === 'ausencia_encargado') setAlertaAusencia(null)
  }

  // Mostrar el banner de mayor prioridad
  const candidatos = [alertaVencida, alertaAusencia, alertaProxima].filter(Boolean) as AlertaBanner[]
  candidatos.sort((a, b) => prioridad(b.tipo) - prioridad(a.tipo))
  const alerta = candidatos[0] ?? null
  if (!alerta) return null

  return (
    <div className="fixed top-0 left-0 right-0 md:left-56 z-50 animate-slide-down">
      <div className="max-w-2xl mx-auto px-3 pt-3">

        {alerta.tipo === 'ronda_vencida' && (
          // ── Banner rojo urgente (ronda vencida) ──────────────────────────
          <div className="bg-red-600 text-white rounded-2xl shadow-2xl px-4 py-3.5 flex items-center gap-3">
            <div className="relative shrink-0">
              <AlertTriangle size={22} className="text-yellow-300" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-300 rounded-full">
                <span className="absolute inset-0 animate-ping rounded-full bg-yellow-300 opacity-60" />
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black uppercase tracking-wide text-yellow-300 leading-none mb-0.5">
                Ronda vencida
              </p>
              <p className="text-sm font-semibold leading-tight">{alerta.mensaje}</p>
              <button
                onClick={() => { marcarLeida(alerta.id); dismiss(alerta); router.push('/tecnico/ronda') }}
                className="flex items-center gap-1 text-xs text-yellow-300 font-bold mt-1 hover:underline"
              >
                <QrCode size={11} />
                Iniciá la ronda ahora
              </button>
            </div>
            <button onClick={() => dismiss(alerta)} className="p-1 text-white/60 hover:text-white shrink-0" aria-label="Cerrar">
              <X size={16} />
            </button>
          </div>
        )}

        {alerta.tipo === 'ausencia_encargado' && (
          // ── Banner ámbar (encargado ausente — solo apoyo ve esto) ─────────
          <div className="bg-amber-500 text-white rounded-2xl shadow-2xl px-4 py-3.5 flex items-center gap-3">
            <div className="relative shrink-0">
              <ShieldAlert size={22} className="text-white" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white rounded-full">
                <span className="absolute inset-0 animate-ping rounded-full bg-white opacity-60" />
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black uppercase tracking-wide text-white/80 leading-none mb-0.5">
                Encargado ausente
              </p>
              <p className="text-sm font-semibold leading-tight">{alerta.mensaje}</p>
              <button
                onClick={() => { dismiss(alerta); router.push('/tecnico/libro-guardia/abrir?interino=1') }}
                className="flex items-center gap-1 text-xs text-white font-bold mt-1 hover:underline"
              >
                <ShieldAlert size={11} />
                Abrir turno como encargado interino
              </button>
            </div>
            <button onClick={() => dismiss(alerta)} className="p-1 text-white/60 hover:text-white shrink-0" aria-label="Cerrar">
              <X size={16} />
            </button>
          </div>
        )}

        {alerta.tipo === 'ronda_proxima' && (
          // ── Banner oscuro (próxima ronda) ──────────────────────────────────
          <div className="bg-brand-ink text-white rounded-2xl shadow-2xl px-4 py-3.5 flex items-center gap-3">
            <div className="relative shrink-0">
              <Bell size={22} className="text-brand-orange" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-brand-orange rounded-full">
                <span className="absolute inset-0 animate-ping rounded-full bg-brand-orange opacity-60" />
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold leading-tight">{alerta.mensaje}</p>
              <button
                onClick={() => { marcarLeida(alerta.id); dismiss(alerta); router.push('/tecnico/ronda') }}
                className="flex items-center gap-1 text-xs text-brand-orange font-semibold mt-0.5 hover:underline"
              >
                <QrCode size={11} />
                Ir a iniciar ronda
              </button>
            </div>
            <button onClick={() => dismiss(alerta)} className="p-1 text-white/60 hover:text-white shrink-0" aria-label="Cerrar">
              <X size={16} />
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
