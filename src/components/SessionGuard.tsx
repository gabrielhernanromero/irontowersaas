'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { LogIn, WifiOff } from 'lucide-react'

export default function SessionGuard() {
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    const client = supabase()

    const { data: { subscription } } = client.auth.onAuthStateChange((event) => {
      // TOKEN_REFRESHED se dispara cuando Supabase renueva el token.
      // SIGNED_OUT cuando la sesión vence definitivamente y no puede renovarse.
      if (event === 'SIGNED_OUT') {
        // Logout manual → no mostrar modal de sesión vencida
        const intencional = sessionStorage.getItem('logout_intencional')
        sessionStorage.removeItem('logout_intencional')
        if (intencional) return

        const path = window.location.pathname
        if (!path.startsWith('/login') && !path.startsWith('/unauthorized')) {
          setExpired(true)
        }
      }
    })

    // También interceptar respuestas 401 de la API interna
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const res = await originalFetch(...args)
      if (res.status === 401) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url
        // Solo considerar rutas internas de API
        if (url.startsWith('/api/') || url.includes(window.location.origin + '/api/')) {
          const path = window.location.pathname
          if (!path.startsWith('/login')) {
            setExpired(true)
          }
        }
      }
      return res
    }

    return () => {
      subscription.unsubscribe()
      window.fetch = originalFetch
    }
  }, [])

  if (!expired) return null

  return (
    <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-slide-up">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 mx-auto mb-4">
          <WifiOff size={26} className="text-amber-600" />
        </div>

        <h2 className="text-lg font-bold text-brand-ink text-center mb-2">
          Sesión vencida
        </h2>
        <p className="text-sm text-gray-500 text-center mb-6 leading-relaxed">
          Tu sesión expiró por inactividad.{' '}
          <strong className="text-brand-ink">Los datos no enviados están guardados localmente</strong>{' '}
          y se sincronizarán al volver a ingresar.
        </p>

        <a
          href="/login"
          className="flex items-center justify-center gap-2 w-full bg-brand-orange text-white font-bold py-3.5 rounded-xl text-base"
        >
          <LogIn size={18} />
          Iniciar sesión
        </a>
      </div>
    </div>
  )
}
