import { getAllPending, dequeue } from './db'

export async function syncPendingQueue(): Promise<{ ok: number; failed: number }> {
  const items = await getAllPending()
  let ok = 0
  let failed = 0

  for (const item of items) {
    try {
      let foto_url: string | undefined

      // Upload photo if present
      if (item.type === 'novedad' && item.fotoBlob) {
        const fd = new FormData()
        fd.append('file', new File([item.fotoBlob], item.fotoName ?? 'foto.jpg', { type: 'image/jpeg' }))
        const uploadRes = await fetch('/api/upload/foto', { method: 'POST', body: fd })
        if (uploadRes.ok) {
          const { path } = await uploadRes.json()
          foto_url = path
        }
      }

      const payload = item.type === 'novedad'
        ? {
            turno_id:                item.turno_id,
            hora:                    item.hora,
            descripcion:             item.descripcion,
            riesgo_detectado:        item.riesgo_detectado,
            medidas_adoptadas:       item.medidas_adoptadas,
            observaciones_generales: item.observaciones_generales,
            es_alerta:               item.es_alerta,
            es_incidencia:           item.es_incidencia,
            incidencia_titulo:       item.incidencia_titulo,
            incidencia_severidad:    item.incidencia_severidad,
            foto_url,
          }
        : null

      if (!payload) continue

      const res = await fetch('/api/libro-novedad', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })

      if (res.ok || res.status === 409) {
        await dequeue(item.id!)
        ok++
      } else {
        failed++
      }
    } catch {
      failed++
    }
  }

  return { ok, failed }
}
