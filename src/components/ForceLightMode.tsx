'use client'

import { useEffect } from 'react'

// Quita la clase `dark` del <html> mientras el componente está montado
// y la restaura al desmontar. Usado en el layout de login.
export function ForceLightMode() {
  useEffect(() => {
    const html = document.documentElement
    const wasDark = html.classList.contains('dark')
    html.classList.remove('dark')
    return () => {
      if (wasDark) html.classList.add('dark')
    }
  }, [])
  return null
}
