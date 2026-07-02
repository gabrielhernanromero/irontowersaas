'use client'

import { LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

export default function LogoutButton() {
  async function handleLogout() {
    sessionStorage.setItem('logout_intencional', '1')
    await supabase().auth.signOut()
    window.location.href = '/login'
  }

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-2 text-white/60 hover:text-white text-sm p-2 rounded transition-colors shrink-0"
    >
      <LogOut size={16} />
      Cerrar sesión
    </button>
  )
}
