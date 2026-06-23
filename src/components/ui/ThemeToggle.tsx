'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/lib/theme/ThemeProvider'

export default function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme()

  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className={`flex items-center gap-2 text-sm w-full p-2 rounded transition-colors ${
        className ?? 'text-white/60 hover:text-white hover:bg-white/10'
      }`}
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
    </button>
  )
}
