import {
  generarPasswordTemporal,
  calcularLockedUntil,
  estaBloqueado,
  minutosRestantesBloqueo,
  MAX_INTENTOS_LOGIN,
  MINUTOS_BLOQUEO,
  LARGO_PASSWORD_TEMPORAL,
} from '@/lib/auth/loginPolicy'

describe('generarPasswordTemporal', () => {
  it('genera una contraseña del largo esperado', () => {
    expect(generarPasswordTemporal()).toHaveLength(LARGO_PASSWORD_TEMPORAL)
    expect(generarPasswordTemporal(20)).toHaveLength(20)
  })

  it('no incluye caracteres ambiguos (0/O, 1/l/I)', () => {
    const password = generarPasswordTemporal(500)
    expect(password).not.toMatch(/[0O1lI]/)
  })

  it('genera contraseñas distintas en llamadas sucesivas', () => {
    const passwords = new Set(Array.from({ length: 20 }, () => generarPasswordTemporal()))
    expect(passwords.size).toBe(20)
  })
})

describe('calcularLockedUntil / estaBloqueado', () => {
  it('calcula un timestamp MINUTOS_BLOQUEO minutos en el futuro', () => {
    const antes = Date.now()
    const lockedUntil = calcularLockedUntil()
    const diffMinutos = (new Date(lockedUntil).getTime() - antes) / 60_000
    expect(diffMinutos).toBeGreaterThan(MINUTOS_BLOQUEO - 0.1)
    expect(diffMinutos).toBeLessThanOrEqual(MINUTOS_BLOQUEO + 0.1)
  })

  it('estaBloqueado es true para un timestamp futuro', () => {
    expect(estaBloqueado(calcularLockedUntil())).toBe(true)
  })

  it('estaBloqueado es false para un timestamp pasado', () => {
    expect(estaBloqueado(new Date(Date.now() - 60_000).toISOString())).toBe(false)
  })

  it('estaBloqueado es false para null', () => {
    expect(estaBloqueado(null)).toBe(false)
  })
})

describe('minutosRestantesBloqueo', () => {
  it('redondea hacia arriba y nunca devuelve menos de 1', () => {
    const casiVencido = new Date(Date.now() + 5_000).toISOString()
    expect(minutosRestantesBloqueo(casiVencido)).toBe(1)
  })

  it('calcula correctamente varios minutos restantes', () => {
    const enDiezMinutos = new Date(Date.now() + 10 * 60_000).toISOString()
    expect(minutosRestantesBloqueo(enDiezMinutos)).toBe(10)
  })
})

describe('constantes de política', () => {
  it('MAX_INTENTOS_LOGIN es razonable (ni muy laxo ni imposible de alcanzar por error)', () => {
    expect(MAX_INTENTOS_LOGIN).toBeGreaterThanOrEqual(3)
    expect(MAX_INTENTOS_LOGIN).toBeLessThanOrEqual(10)
  })
})
