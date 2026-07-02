'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Home, Package, BookOpen, QrCode } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { LogoutButton } from './LogoutButton'

interface Props {
  userId: string
  initialGuardia: number
  initialRondas: number
  initialElementos: number
}

export default function NavRealtime({ userId, initialGuardia, initialRondas, initialElementos }: Props) {
  const [guardia,   setGuardia]   = useState(initialGuardia)
  const [rondas,    setRondas]    = useState(initialRondas)
  const [elementos, setElementos] = useState(initialElementos)

  // Ref para evitar actualizar estado en componente desmontado
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    const sb = supabase()

    async function refresh() {
      try {
        const res = await fetch('/api/me/badge-counts', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        })
        if (!res.ok || !mounted.current) return
        const data = await res.json()
        setGuardia(data.guardia)
        setRondas(data.rondas)
        setElementos(data.elementos)
      } catch { /* ignorar errores de red */ }
    }

    // Realtime: recibe eventos de INSERT y UPDATE en alertas
    // RLS garantiza que solo llegan las del usuario autenticado
    const channel = sb
      .channel(`nav-badges-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alertas' }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'alertas' }, refresh)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') refresh()
      })

    // Evento custom: GuardiaAlertsReader lo dispara al marcar alertas como leídas
    window.addEventListener('guardia-alertas-read', refresh)

    // Polling cada 6s como red de seguridad
    const interval = setInterval(refresh, 6000)

    return () => {
      mounted.current = false
      clearInterval(interval)
      window.removeEventListener('guardia-alertas-read', refresh)
      sb.removeChannel(channel)
    }
  }, [userId])

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200">
      <div className="max-w-[430px] mx-auto flex">
        <NavItem href="/tecnico/home"          icon={<Home     size={22} />} label="Inicio"    />
        <NavItem href="/tecnico/elementos"     icon={<Package  size={22} />} label="Elementos" badge={elementos} />
        <NavItem href="/tecnico/libro-guardia" icon={<BookOpen size={22} />} label="Guardia"   badge={guardia}   />
        <NavItem href="/tecnico/ronda"         icon={<QrCode   size={22} />} label="Rondas"    badge={rondas}    />
        <LogoutButton />
      </div>
    </nav>
  )
}

function NavItem({
  href, icon, label, badge = 0,
}: {
  href: string
  icon: React.ReactNode
  label: string
  badge?: number
}) {
  return (
    <Link
      href={href}
      className="flex-1 flex flex-col items-center justify-center gap-1 py-3 min-h-[56px] text-brand-ink hover:text-brand-orange transition-colors"
    >
      <div className="relative">
        {icon}
        {badge > 0 && (
          <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 bg-brand-orange text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      <span className="text-xs">{label}</span>
    </Link>
  )
}
