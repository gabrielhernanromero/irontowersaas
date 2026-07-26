/**
 * Unit test — POST /api/auth/cambiar-password
 * Mismo enfoque de mocking que auth-login-route.test.ts: sin red, sin DB real.
 */

import { NextRequest } from 'next/server'

jest.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: jest.fn() }))
jest.mock('@/lib/supabase/server', () => ({ supabaseServer: jest.fn() }))
jest.mock('@/lib/auth/logAuthEvent', () => ({
  logAuthEvent: jest.fn().mockResolvedValue(undefined),
  getRequestIp: jest.fn().mockReturnValue('127.0.0.1'),
}))

import { supabaseAdmin } from '@/lib/supabase/admin'
import { supabaseServer } from '@/lib/supabase/server'
import { POST } from '@/app/api/auth/cambiar-password/route'

function makeBuilder(result: { data: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {}
  builder.update = jest.fn(() => builder)
  builder.eq = jest.fn(() => builder)
  builder.select = jest.fn(() => builder)
  builder.single = jest.fn(() => Promise.resolve(result))
  return builder
}

function mockAdmin(result: { data: unknown; error?: unknown }) {
  const builder = makeBuilder(result)
  ;(supabaseAdmin as jest.Mock).mockReturnValue({ from: jest.fn(() => builder) })
  return builder
}

function mockServer({ user, updateError = null }: { user: { id: string; email: string } | null; updateError?: unknown }) {
  const getUser = jest.fn().mockResolvedValue({ data: { user } })
  const updateUser = jest.fn().mockResolvedValue({ error: updateError })
  ;(supabaseServer as jest.Mock).mockReturnValue({ auth: { getUser, updateUser } })
  return { getUser, updateUser }
}

function req(body: unknown) {
  return new NextRequest('http://localhost/api/auth/cambiar-password', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => jest.clearAllMocks())

describe('POST /api/auth/cambiar-password', () => {
  it('rechaza contraseñas de menos de 8 caracteres', async () => {
    mockServer({ user: { id: 'u1', email: 'a@test.com' } })
    const res = await POST(req({ password: 'corta1', confirmPassword: 'corta1' }))
    expect(res.status).toBe(400)
  })

  it('rechaza si las contraseñas no coinciden', async () => {
    mockServer({ user: { id: 'u1', email: 'a@test.com' } })
    const res = await POST(req({ password: 'password123', confirmPassword: 'otraPassword123' }))
    expect(res.status).toBe(400)
  })

  it('devuelve 401 si no hay sesión activa', async () => {
    mockServer({ user: null })
    const res = await POST(req({ password: 'password123', confirmPassword: 'password123' }))
    expect(res.status).toBe(401)
  })

  it('cambia la contraseña, limpia must_change_password y devuelve el redirect por rol', async () => {
    mockServer({ user: { id: 'u1', email: 'a@test.com' } })
    const builder = mockAdmin({ data: { rol: 'tecnico' }, error: null })

    const res = await POST(req({ password: 'password123', confirmPassword: 'password123' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.redirectTo).toBe('/tecnico/home')
    expect((builder.update as jest.Mock).mock.calls[0][0]).toEqual({ must_change_password: false })
  })
})
