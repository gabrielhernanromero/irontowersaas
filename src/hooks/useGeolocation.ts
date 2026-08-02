'use client'

import { useEffect, useState } from 'react'

export interface GpsCaptura {
  latitud: number | null
  longitud: number | null
  precision_m: number | null
  capturado_at: string | null  // ISO — momento real de la captura, no del submit
}

export type GeolocationStatus = 'pending' | 'resolved' | 'denied' | 'timeout' | 'unsupported'

const SIN_DATOS: GpsCaptura = {
  latitud: null,
  longitud: null,
  precision_m: null,
  capturado_at: null,
}

/**
 * Pide la ubicación una sola vez, en background, apenas se monta el
 * componente (no al enviar el formulario) — para que el fix ya esté
 * resuelto cuando el usuario termina de completarlo. Nunca bloquea: si no
 * hay permiso o el GPS no resuelve a tiempo, `data` queda en null y el
 * componente que lo usa debe enviar el formulario igual.
 */
export function useGeolocation(timeoutMs = 15000): { status: GeolocationStatus; data: GpsCaptura | null } {
  const [status, setStatus] = useState<GeolocationStatus>('pending')
  const [data, setData] = useState<GpsCaptura | null>(null)

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unsupported')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setData({
          latitud: position.coords.latitude,
          longitud: position.coords.longitude,
          precision_m: position.coords.accuracy,
          capturado_at: new Date().toISOString(),
        })
        setStatus('resolved')
      },
      (err) => {
        setStatus(err.code === err.TIMEOUT ? 'timeout' : 'denied')
        setData(SIN_DATOS)
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    )
  }, [timeoutMs])

  return { status, data }
}
