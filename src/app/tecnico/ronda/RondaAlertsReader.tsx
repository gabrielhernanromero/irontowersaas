'use client'

import { useEffect } from 'react'

export default function RondaAlertsReader() {
  useEffect(() => {
    fetch('/api/me/alertas-read', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipos: ['ronda_proxima', 'ronda_vencida', 'ronda_asignada'] }),
    }).then(() => {
      window.dispatchEvent(new Event('guardia-alertas-read'))
    })
  }, [])

  return null
}
