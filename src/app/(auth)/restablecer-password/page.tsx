'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import CambiarPasswordForm from '../cambiar-password/CambiarPasswordForm'

const TIMEOUT_MS = 6000

export default function RestablecerPasswordPage() {
  const [estado, setEstado] = useState<'validando' | 'listo' | 'error'>('validando')

  useEffect(() => {
    // Supabase agrega #error=... al hash cuando el link venció o ya se usó
    if (window.location.hash.includes('error=')) {
      setEstado('error')
      return
    }

    const { data: { subscription } } = supabase().auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setEstado('listo')
    })

    // Si el SDK ya procesó el hash antes de que nos suscribamos, chequeamos sesión directo
    supabase().auth.getSession().then(({ data: { session } }) => {
      if (session) setEstado(prev => (prev === 'validando' ? 'listo' : prev))
    })

    const timeout = setTimeout(() => {
      setEstado(prev => (prev === 'validando' ? 'error' : prev))
    }, TIMEOUT_MS)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  return (
    <div className="w-full max-w-sm">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-brand-ink">Elegí tu nueva contraseña</h1>
        </div>

        {estado === 'validando' && (
          <p className="text-center text-brand-muted text-base">Validando el link...</p>
        )}

        {estado === 'error' && (
          <div className="space-y-4 text-center">
            <p className="text-base bg-red-50 text-brand-danger rounded-lg px-3 py-3">
              Este link venció o no es válido. Pedí uno nuevo.
            </p>
            <a
              href="/recuperar-password"
              className="block text-center text-base text-brand-muted hover:text-brand-ink underline min-h-[44px] leading-[44px]"
            >
              Pedir un nuevo link
            </a>
          </div>
        )}

        {estado === 'listo' && <CambiarPasswordForm />}
      </div>
    </div>
  )
}
