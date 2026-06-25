'use client'

import { useEffect } from 'react'

export default function GuardiaAlertsReader({ turnoId }: { turnoId: string }) {
  useEffect(() => {
    // Marca alertas de novedades del apoyo/encargado como leídas para este turno
    fetch('/api/libro-novedad/alertas-read', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turno_id: turnoId }),
    }).then(() => {
      window.dispatchEvent(new Event('guardia-alertas-read'))
    })
  }, [turnoId]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
