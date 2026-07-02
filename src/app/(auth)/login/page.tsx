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
      const sb = supabase()
      await sb.auth.signOut()

      const { data, error: authError } = await sb.auth.signInWithPassword({
        email: emailVal,
        password: passwordVal,
      })

      if (authError || !data.session) {
        setError(`Auth: ${authError?.message ?? 'sin sesión'}`)
        setLoading(false)
        return
      }

      const res = await fetch('/api/auth/role-redirect', {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      })

      if (!res.ok) {
        setError(`API error ${res.status}`)
        setLoading(false)
        return
      }

      const { redirectTo } = await res.json()

      if (!redirectTo || redirectTo === '/login') {
        setError(`Sin rol asignado (redirectTo=${redirectTo})`)
        setLoading(false)
        return
      }

      window.location.href = redirectTo
    } catch (e) {
      setError(`Excepción: ${e instanceof Error ? e.message : String(e)}`)
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await doLogin(email, password)
  }

  const TEST_USERS = [
    { label: 'Supervisor',  sub: 'Roberto López',    email: 'supervisor@irontower.com',       password: 'super123',   color: 'bg-purple-50 border-purple-200 text-purple-800' },
    { label: 'Martín',      sub: 'Álvarez',          email: 'martin.alvarez@irontower.com',   password: 'IronTec1!', color: 'bg-blue-50 border-blue-200 text-blue-800' },
    { label: 'Laura',       sub: 'Benítez',          email: 'laura.benitez@irontower.com',    password: 'IronTec2!', color: 'bg-blue-50 border-blue-200 text-blue-800' },
    { label: 'Diego',       sub: 'Castillo',         email: 'diego.castillo@irontower.com',   password: 'IronTec3!', color: 'bg-blue-50 border-blue-200 text-blue-800' },
    { label: 'Sofía',       sub: 'Díaz',             email: 'sofia.diaz@irontower.com',       password: 'IronTec4!', color: 'bg-blue-50 border-blue-200 text-blue-800' },
    { label: 'Pablo',       sub: 'García',           email: 'pablo.garcia@irontower.com',     password: 'IronTec5!', color: 'bg-blue-50 border-blue-200 text-blue-800' },
    { label: 'Natalia',     sub: 'Herrera',          email: 'natalia.herrera@irontower.com',  password: 'IronTec6!', color: 'bg-blue-50 border-blue-200 text-blue-800' },
  ]

  async function loginDirecto(emailVal: string, passwordVal: string) {
    await doLogin(emailVal, passwordVal)
  }

  return (
    <div className="w-full max-w-sm">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-brand-dark font-condensed">
            Iron Tower
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
                disabled={loading}
                onClick={() => loginDirecto(u.email, u.password)}
                className={`flex items-center justify-between border rounded-lg px-3 py-2 text-left transition-opacity active:opacity-70 min-h-[44px] disabled:opacity-50 ${u.color}`}
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
