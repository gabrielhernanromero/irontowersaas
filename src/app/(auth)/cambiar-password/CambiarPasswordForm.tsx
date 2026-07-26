'use client'

import { useState } from 'react'

export default function CambiarPasswordForm() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/auth/cambiar-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, confirmPassword }),
      })
      const body = await res.json()

      if (!res.ok) {
        setError(body.error ?? 'No se pudo cambiar la contraseña')
        setLoading(false)
        return
      }

      window.location.href = body.redirectTo ?? '/login'
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="password" className="block text-base font-medium text-brand-ink mb-1">
          Nueva contraseña
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full px-4 py-3 rounded-lg border border-brand-light-border bg-brand-light-bg text-brand-ink text-base focus:outline-none focus:ring-2 focus:ring-brand-blue min-h-[44px]"
          placeholder="Mínimo 8 caracteres"
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-base font-medium text-brand-ink mb-1">
          Confirmar contraseña
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full px-4 py-3 rounded-lg border border-brand-light-border bg-brand-light-bg text-brand-ink text-base focus:outline-none focus:ring-2 focus:ring-brand-blue min-h-[44px]"
          placeholder="Repetí la contraseña"
        />
      </div>

      {error && (
        <p className="text-brand-danger text-base bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 px-4 bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold rounded-lg text-base transition-colors disabled:opacity-60 min-h-[44px]"
      >
        {loading ? 'Guardando...' : 'Guardar contraseña'}
      </button>
    </form>
  )
}
