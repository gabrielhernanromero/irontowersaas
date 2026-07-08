'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function doLogin(emailVal: string, passwordVal: string) {
    setError(null)
    setLoading(true)

    try {
      const { data, error: authError } = await supabase().auth.signInWithPassword({
        email: emailVal,
        password: passwordVal,
      })

      if (authError || !data.session) {
        setError('Email o contraseña incorrectos')
        setLoading(false)
        return
      }

      const ctrl = new AbortController()
      const tid = setTimeout(() => ctrl.abort(), 8000)

      const res = await fetch('/api/auth/role-redirect', {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        signal: ctrl.signal,
      })
      clearTimeout(tid)

      const { redirectTo } = await res.json()
      window.location.href = redirectTo ?? '/login'
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await doLogin(email, password)
  }

  return (
    <div className="w-full max-w-sm">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-1">
            {/* CentralBase icon — eye/network shape */}
            <svg viewBox="0 0 160 100" className="h-10 w-auto" xmlns="http://www.w3.org/2000/svg">
              <g stroke="#E8A87C" strokeWidth="1.8" fill="none">
                {/* Perimeter */}
                <polygon points="5,50 32,20 80,5 128,20 155,50 128,80 80,95 32,80" />
                {/* Spokes to center */}
                <line x1="80" y1="50" x2="5"   y2="50" />
                <line x1="80" y1="50" x2="155" y2="50" />
                <line x1="80" y1="50" x2="80"  y2="5"  />
                <line x1="80" y1="50" x2="80"  y2="95" />
                <line x1="80" y1="50" x2="32"  y2="20" />
                <line x1="80" y1="50" x2="128" y2="20" />
                <line x1="80" y1="50" x2="32"  y2="80" />
                <line x1="80" y1="50" x2="128" y2="80" />
              </g>
              {/* Outer nodes */}
              <g fill="#1E3A5F">
                <circle cx="5"   cy="50" r="5" />
                <circle cx="155" cy="50" r="5" />
                <circle cx="80"  cy="5"  r="5" />
                <circle cx="80"  cy="95" r="5" />
                <circle cx="32"  cy="20" r="5" />
                <circle cx="128" cy="20" r="5" />
                <circle cx="32"  cy="80" r="5" />
                <circle cx="128" cy="80" r="5" />
              </g>
              {/* Center node */}
              <circle cx="80" cy="50" r="11" fill="#C87842" />
            </svg>
            <span className="text-3xl font-bold leading-none tracking-tight">
              <span style={{ color: '#1E3A5F' }}>Central</span>
              <span style={{ color: '#C87842' }}>Base</span>
            </span>
          </div>
          <p className="text-brand-muted text-sm mt-2">Ingresá con tu cuenta</p>
        </div>


        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-brand-ink mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-4 py-3 rounded-lg border border-brand-light-border bg-brand-light-bg text-brand-ink text-base focus:outline-none focus:ring-2 focus:ring-brand-blue"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-brand-ink mb-1">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-4 py-3 rounded-lg border border-brand-light-border bg-brand-light-bg text-brand-ink text-base focus:outline-none focus:ring-2 focus:ring-brand-blue"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-brand-danger text-sm bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold rounded-lg text-base transition-colors disabled:opacity-60 min-h-[44px]"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
