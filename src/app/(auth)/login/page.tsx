'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: authError } = await supabase().auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError('Email o contraseña incorrectos')
      setLoading(false)
      return
    }

    // Leer el usuario ya autenticado para obtener su rol
    const { data: { user } } = await supabase().auth.getUser()
    const rol = user?.user_metadata?.rol as string | undefined

    if (!rol) {
      setError('No se pudo determinar el rol del usuario. Contactá al administrador.')
      setLoading(false)
      return
    }

    const redirectTo =
      rol === 'tecnico' ? '/tecnico/home'
      : rol === 'supervisor' || rol === 'admin' ? '/supervisor/dashboard'
      : null

    if (!redirectTo) {
      setError(`Rol "${rol}" no reconocido.`)
      setLoading(false)
      return
    }

    window.location.href = redirectTo
  }

  const TEST_USERS = [
    { label: 'Técnico A',   sub: 'Juan',    email: 'tecnico@irontower.com',   password: 'tecnico123', color: 'bg-blue-50 border-blue-200 text-blue-800' },
    { label: 'Técnico B',   sub: 'Carlos',  email: 'tecnico2@irontower.com',  password: 'tecnico456', color: 'bg-blue-50 border-blue-200 text-blue-800' },
    { label: 'Supervisor',  sub: 'Gabriel', email: 'supervisor@irontower.com', password: 'super123',  color: 'bg-purple-50 border-purple-200 text-purple-800' },
  ]

  return (
    <div className="w-full max-w-sm">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-brand-dark font-condensed">
            Iron Tower OS
          </h1>
          <p className="text-brand-muted text-sm mt-1">Ingresá con tu cuenta</p>
        </div>

        {/* Acceso rápido dev */}
        <div className="mb-5">
          <p className="text-xs text-gray-400 mb-2 font-medium">⚡ Acceso rápido (demo)</p>
          <div className="flex flex-col gap-2">
            {TEST_USERS.map((u) => (
              <button
                key={u.email}
                type="button"
                onClick={() => { setEmail(u.email); setPassword(u.password) }}
                className={`flex items-center justify-between border rounded-lg px-3 py-2 text-left transition-opacity active:opacity-70 min-h-[44px] ${u.color}`}
              >
                <div>
                  <p className="text-xs font-bold">{u.label} — {u.sub}</p>
                  <p className="text-xs opacity-70">{u.email}</p>
                </div>
                <span className="text-xs font-mono bg-white/60 px-2 py-0.5 rounded ml-2 shrink-0">
                  {u.password}
                </span>
              </button>
            ))}
          </div>
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
