'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

export function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    sessionStorage.setItem('logout_intencional', '1')
    await supabase().auth.signOut()
    window.location.href = '/login'
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
