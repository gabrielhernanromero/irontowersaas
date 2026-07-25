'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export default function RecuperarPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    await supabase().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/restablecer-password`,
    })

    // Mensaje siempre genérico — no revela si el email existe o no
    setEnviado(true)
    setLoading(false)
  }

  return (
    <div className="w-full max-w-sm">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-brand-ink">Recuperar contraseña</h1>
          <p className="text-brand-muted text-base mt-2">
            Ingresá tu email y te mandamos un link para elegir una nueva contraseña.
          </p>
        </div>

        {enviado ? (
          <div className="space-y-4">
            <p className="text-base bg-green-50 text-green-800 rounded-lg px-3 py-3">
              Si el email está registrado, en unos minutos vas a recibir un link para restablecer tu contraseña. Revisá también la carpeta de spam.
            </p>
            <a
              href="/login"
              className="block text-center text-base text-brand-muted hover:text-brand-ink underline min-h-[44px] leading-[44px]"
            >
              Volver al login
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-base font-medium text-brand-ink mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3 rounded-lg border border-brand-light-border bg-brand-light-bg text-brand-ink text-base focus:outline-none focus:ring-2 focus:ring-brand-blue min-h-[44px]"
                placeholder="tu@email.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold rounded-lg text-base transition-colors disabled:opacity-60 min-h-[44px]"
            >
              {loading ? 'Enviando...' : 'Enviar link'}
            </button>

            <a
              href="/login"
              className="block text-center text-base text-brand-muted hover:text-brand-ink underline min-h-[44px] leading-[44px]"
            >
              Volver al login
            </a>
          </form>
        )}
      </div>
    </div>
  )
}
