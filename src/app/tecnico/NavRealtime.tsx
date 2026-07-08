'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Home, Package, BookOpen, QrCode } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { LogoutButton } from './LogoutButton'
import CentralBaseLogo from '@/components/ui/CentralBaseLogo'

interface Props {
  userId: string
  userName: string
  initialGuardia: number
  initialRondas: number
  initialElementos: number
}

export default function NavRealtime({ userId, userName, initialGuardia, initialRondas, initialElementos }: Props) {
  const [guardia,   setGuardia]   = useState(initialGuardia)
  const [rondas,    setRondas]    = useState(initialRondas)
  const [elementos, setElementos] = useState(initialElementos)

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

    const channel = sb
      .channel(`nav-badges-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alertas' }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'alertas' }, refresh)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') refresh()
      })

    window.addEventListener('guardia-alertas-read', refresh)
    const interval = setInterval(refresh, 6000)

    return () => {
      mounted.current = false
      clearInterval(interval)
      window.removeEventListener('guardia-alertas-read', refresh)
      sb.removeChannel(channel)
    }
  }, [userId])

  return (
    <>
      {/* Sidebar — tablet/desktop */}
      <aside className="hidden md:flex flex-col w-56 bg-brand-ink text-white shrink-0">
        <div className="p-5 border-b border-white/10">
          <CentralBaseLogo inverted />
          <p className="text-xs text-white/60 mt-2 truncate">{userName}</p>
        </div>
        <nav className="flex flex-col gap-1 p-3 flex-1">
          <SideItem href="/tecnico/home"          icon={<Home     size={18} />} label="Inicio"           />
          <SideItem href="/tecnico/elementos"     icon={<Package  size={18} />} label="Elementos"        badge={elementos} />
          <SideItem href="/tecnico/libro-guardia" icon={<BookOpen size={18} />} label="Libro de Guardia" badge={guardia}   />
          <SideItem href="/tecnico/ronda"         icon={<QrCode   size={18} />} label="Rondas"           badge={rondas}    />
        </nav>
        <div className="p-3 border-t border-white/10">
          <LogoutButton variant="sidebar" />
        </div>
      </aside>

      {/* Bottom nav — móvil */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200">
        <div className="flex">
          <NavItem href="/tecnico/home"          icon={<Home     size={22} />} label="Inicio"    />
          <NavItem href="/tecnico/elementos"     icon={<Package  size={22} />} label="Elementos" badge={elementos} />
          <NavItem href="/tecnico/libro-guardia" icon={<BookOpen size={22} />} label="Guardia"   badge={guardia}   />
          <NavItem href="/tecnico/ronda"         icon={<QrCode   size={22} />} label="Rondas"    badge={rondas}    />
          <LogoutButton />
        </div>
      </nav>
    </>
  )
}

function SideItem({
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
      className="flex items-center gap-3 px-3 py-2 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors text-sm"
    >
      <div className="relative shrink-0">
        {icon}
        {badge > 0 && (
          <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 bg-brand-orange text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      <span>{label}</span>
    </Link>
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
