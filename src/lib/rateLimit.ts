// Sliding window rate limiter — in-memory, keyed por userId o IP.
// En Vercel serverless cada instancia tiene su propia memoria,
// lo que es suficiente para proteger contra abuso rápido en una misma instancia.
// Para protección multi-instancia a escala, migrar a Upstash Redis.

interface Window {
  count:    number
  resetAt:  number
}

const store = new Map<string, Window>()

interface RateLimitConfig {
  maxRequests: number   // máx solicitudes en la ventana
  windowMs:    number   // duración de la ventana en ms
}

interface RateLimitResult {
  allowed:    boolean
  remaining:  number
  resetAt:    number
}

export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key)

  // Si no existe entrada o la ventana ya expiró, crear nueva
  if (!entry || now > entry.resetAt) {
    const resetAt = now + config.windowMs
    store.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: config.maxRequests - 1, resetAt }
  }

  // Ventana activa
  if (entry.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { allowed: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt }
}

// Limpiar entradas expiradas cada 5 minutos para evitar memory leak
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    Array.from(store.entries()).forEach(([key, win]) => {
      if (now > win.resetAt) store.delete(key)
    })
  }, 5 * 60 * 1000)
}

// Límites predefinidos
export const LIMITS = {
  novedad:   { maxRequests: 15,  windowMs: 60_000 },  // 15 novedades/min
  upload:    { maxRequests: 30,  windowMs: 60_000 },  // 30 fotos/min — 10 quedaba corto para un técnico cargando varios ítems con foto seguidos
  push:      { maxRequests: 5,   windowMs: 60_000 },  // 5 suscripciones/min
  auth:      { maxRequests: 5,   windowMs: 60_000 },  // 5 logins/min por IP
} satisfies Record<string, RateLimitConfig>
