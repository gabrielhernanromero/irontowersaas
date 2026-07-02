'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

export function LogoutButton({ variant = 'bottom' }: { variant?: 'bottom' | 'sidebar' } = {}) {
  const router = useRouter()

  async function handleLogout() {
    sessionStorage.setItem('logout_intencional', '1')
    await supabase().auth.signOut()
    window.location.href = '/login'
  }

  if (variant === 'sidebar') {
    return (
      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-3 py-2 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors text-sm w-full"
      >
        <LogOut size={18} />
        <span>Cerrar sesión</span>
      </button>
    )
  }

  return (
    <button
      onClick={handleLogout}
      className="flex-1 flex flex-col items-center justify-center gap-1 py-3 min-h-[56px] text-brand-ink hover:text-red-500 transition-colors"
    >
      <LogOut size={22} />
      <span className="text-xs">Salir</span>
    </button>
  )
}
