// GPS Fase 1 — cálculo de distancia y clasificación de geocerca.
// Módulo puro (sin dependencias de Supabase/Next), usado tanto en rutas API
// como en server components del dashboard.

export const UMBRAL_EXCEPCION_M = 200  // hasta acá: normal, sin marca
export const UMBRAL_ALERTA_M = 1000    // más de esto: alerta activa a supervisores

export type EstadoGeocerca = 'normal' | 'excepcion' | 'alerta' | 'sin_datos'

export interface PuntoGeografico {
  lat: number | null
  lon: number | null
}

function toRadianes(grados: number): number {
  return (grados * Math.PI) / 180
}

/** Distancia en metros entre dos coordenadas, fórmula de Haversine. */
export function distanciaHaversineMetros(
  lat1: number, lon1: number, lat2: number, lon2: number
): number {
  const RADIO_TIERRA_M = 6371000
  const dLat = toRadianes(lat2 - lat1)
  const dLon = toRadianes(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadianes(lat1)) * Math.cos(toRadianes(lat2)) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return RADIO_TIERRA_M * c
}

/**
 * Clasifica una distancia contra los dos umbrales. Cortes estrictamente
 * mayores (`>`): el valor exacto del umbral cae del lado más permisivo.
 */
export function clasificarDistancia(distanciaM: number | null): EstadoGeocerca {
  if (distanciaM === null) return 'sin_datos'
  if (distanciaM > UMBRAL_ALERTA_M) return 'alerta'
  if (distanciaM > UMBRAL_EXCEPCION_M) return 'excepcion'
  return 'normal'
}

/** Combina captura + referencia en un solo cálculo. Nunca lanza excepción. */
export function evaluarGeocerca(
  capturada: PuntoGeografico,
  referencia: PuntoGeografico
): { distanciaM: number | null; estado: EstadoGeocerca } {
  if (
    capturada.lat === null || capturada.lon === null ||
    referencia.lat === null || referencia.lon === null
  ) {
    return { distanciaM: null, estado: 'sin_datos' }
  }
  const distanciaM = distanciaHaversineMetros(capturada.lat, capturada.lon, referencia.lat, referencia.lon)
  return { distanciaM, estado: clasificarDistancia(distanciaM) }
}
