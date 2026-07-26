/**
 * Unit test — POST /api/auth/login
 *
 * Mockea supabaseAdmin/supabaseServer/logAuthEvent para probar la lógica
 * de bloqueo por fuerza bruta y el redirect por must_change_password sin
 * tocar red ni la base real (a diferencia de tests/integration/relevo-lifecycle,
 * acá no hace falta: la lógica de negocio vive entera en el route handler).
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
import { POST } from '@/app/api/auth/login/route'

type Perfil = {
  id: string
  rol: string
  activo: boolean
  must_change_password: boolean
  failed_login_attempts: number
  locked_until: string | null
}

function makeBuilder(result: { data: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {}
  builder.select = jest.fn(() => builder)
  builder.update = jest.fn(() => builder)
  builder.eq = jest.fn(() => builder)
  builder.maybeSingle = jest.fn(() => Promise.resolve(result))
  builder.single = jest.fn(() => Promise.resolve(result))
  builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)
  return builder
}

/** results[0] = respuesta del SELECT de perfil, results[1] = respuesta del UPDATE (si ocurre) */
function mockAdmin(results: Array<{ data: unknown; error?: unknown }>) {
  const fromMock = jest.fn()
  const builders = results.map(makeBuilder)
  builders.forEach(b => fromMock.mockReturnValueOnce(b))
  ;(supabaseAdmin as jest.Mock).mockReturnValue({ from: fromMock })
  return builders
}

function mockSignIn(result: { data: { session: unknown }; error: unknown }) {
  const signInWithPassword = jest.fn().mockResolvedValue(result)
  ;(supabaseServer as jest.Mock).mockReturnValue({ auth: { signInWithPassword } })
  return signInWithPassword
}

function req(body: unknown) {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function perfilBase(overrides: Partial<Perfil> = {}): Perfil {
  return {
    id: 'user-1',
    rol: 'tecnico',
    activo: true,
    must_change_password: false,
    failed_login_attempts: 0,
    locked_until: null,
    ...overrides,
  }
}

beforeEach(() => jest.clearAllMocks())

describe('POST /api/auth/login', () => {
  it('bloquea la cuenta al llegar al 5º intento fallido', async () => {
    const perfil = perfilBase({ failed_login_attempts: 4 })
    const builders = mockAdmin([{ data: perfil, error: null }, { data: null, error: null }])
    mockSignIn({ data: { session: null }, error: { message: 'Invalid login credentials' } })

    const res = await POST(req({ email: 'tecnico@test.com', password: 'mala' }))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toMatch(/incorrectos/i)
    const updateArgs = (builders[1].update as jest.Mock).mock.calls[0][0]
    expect(updateArgs.failed_login_attempts).toBe(5)
    expect(updateArgs.locked_until).toBeTruthy()
  })

  it('no llama a signInWithPassword si la cuenta ya está bloqueada', async () => {
    const perfil = perfilBase({ locked_until: new Date(Date.now() + 5 * 60_000).toISOString() })
    mockAdmin([{ data: perfil, error: null }])
    const signIn = mockSignIn({ data: { session: null }, error: null })

    const res = await POST(req({ email: 'tecnico@test.com', password: 'cualquiera' }))
    const json = await res.json()

    expect(res.status).toBe(423)
    expect(json.error).toMatch(/bloqueada/i)
    expect(signIn).not.toHaveBeenCalled()
  })

  it('rechaza el login si la cuenta está desactivada', async () => {
    const perfil = perfilBase({ activo: false })
    mockAdmin([{ data: perfil, error: null }])
    const signIn = mockSignIn({ data: { session: null }, error: null })

    const res = await POST(req({ email: 'tecnico@test.com', password: 'cualquiera' }))
    expect(res.status).toBe(403)
    expect(signIn).not.toHaveBeenCalled()
  })

  it('resetea el contador de intentos tras un login exitoso', async () => {
    const perfil = perfilBase({ failed_login_attempts: 3 })
    const builders = mockAdmin([{ data: perfil, error: null }, { data: null, error: null }])
    mockSignIn({ data: { session: { access_token: 'x' } }, error: null })

    const res = await POST(req({ email: 'tecnico@test.com', password: 'buena' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.redirectTo).toBe('/tecnico/home')
    const updateArgs = (builders[1].update as jest.Mock).mock.calls[0][0]
    expect(updateArgs.failed_login_attempts).toBe(0)
    expect(updateArgs.locked_until).toBeNull()
  })

  it('redirige a /cambiar-password cuando must_change_password es true', async () => {
    const perfil = perfilBase({ must_change_password: true, rol: 'supervisor' })
    mockAdmin([{ data: perfil, error: null }, { data: null, error: null }])
    mockSignIn({ data: { session: { access_token: 'x' } }, error: null })

    const res = await POST(req({ email: 'sup@test.com', password: 'buena' }))
    const json = await res.json()

    expect(json.redirectTo).toBe('/cambiar-password')
  })
})
