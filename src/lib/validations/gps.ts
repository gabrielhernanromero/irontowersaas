import { z } from 'zod'

/**
 * Campos de captura de GPS, reusados con distintos prefijos según el evento
 * (firma_, apertura_, cierre_, relevo_). Siempre nullable/opcional — el GPS
 * nunca debe poder bloquear un envío por ausencia o denegación de permiso.
 */
export function gpsCapturaFields<P extends string>(prefix: P) {
  return {
    [`${prefix}_latitud`]: z.number().min(-90).max(90).nullable().optional(),
    [`${prefix}_longitud`]: z.number().min(-180).max(180).nullable().optional(),
    [`${prefix}_precision_m`]: z.number().nonnegative().nullable().optional(),
    [`${prefix}_gps_capturado_at`]: z.string().nullable().optional(),
  } as unknown as Record<`${P}_latitud` | `${P}_longitud` | `${P}_precision_m` | `${P}_gps_capturado_at`, z.ZodTypeAny>
}
