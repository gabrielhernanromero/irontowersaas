import { randomBytes } from 'crypto'

export const MAX_INTENTOS_LOGIN = 5
export const MINUTOS_BLOQUEO = 15
export const LARGO_PASSWORD_TEMPORAL = 12

// Sin caracteres ambiguos (0/O, l/1/I) — se lee por WhatsApp o por teléfono
const ALFABETO_PASSWORD_TEMPORAL = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'

export function generarPasswordTemporal(largo = LARGO_PASSWORD_TEMPORAL): string {
  const bytes = randomBytes(largo)
  let password = ''
  for (let i = 0; i < largo; i++) {
    password += ALFABETO_PASSWORD_TEMPORAL[bytes[i] % ALFABETO_PASSWORD_TEMPORAL.length]
  }
  return password
}

export function calcularLockedUntil(): string {
  return new Date(Date.now() + MINUTOS_BLOQUEO * 60_000).toISOString()
}

export function estaBloqueado(lockedUntil: string | null): boolean {
  if (!lockedUntil) return false
  return new Date(lockedUntil).getTime() > Date.now()
}

export function minutosRestantesBloqueo(lockedUntil: string): number {
  return Math.max(1, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 60_000))
}
