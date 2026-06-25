import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendPushToUser } from '@/lib/push/sendPush'

/**
 * Crea alertas `novedad_apoyo` entre encargado y apoyo cuando se registra
 * cualquier novedad en el libro (manual o generada por planilla).
 *
 * - Si el autor es el apoyo → alerta al encargado
 * - Si el autor es el encargado → alerta a todos los apoyo del turno
 */
export async function notificarNovedad({
  autorId,
  encargadoId,
  turnoId,
  novedadId,
  mensaje,
  pushTitle,
}: {
  autorId:      string
  encargadoId:  string
  turnoId:      string
  novedadId:    string
  mensaje:      string
  pushTitle:    string
}) {
  const esApoyo = autorId !== encargadoId

  if (esApoyo) {
    await supabaseAdmin().from('alertas').insert({
      tipo:            'novedad_apoyo',
      mensaje,
      destinatario_id: encargadoId,
      turno_id:        turnoId,
      novedad_id:      novedadId,
      leida:           false,
      resuelta:        false,
    })
    sendPushToUser(encargadoId, {
      title: pushTitle,
      body:  mensaje.slice(0, 100),
      url:   '/tecnico/libro-guardia',
    }).catch(() => {})
  } else {
    // Notificar a todos los apoyo del turno
    const { data: participaciones } = await supabaseAdmin()
      .from('participaciones_turno')
      .select('usuario_id')
      .eq('turno_id', turnoId)

    if (participaciones && participaciones.length > 0) {
      await supabaseAdmin().from('alertas').insert(
        participaciones.map(p => ({
          tipo:            'novedad_apoyo' as const,
          mensaje,
          destinatario_id: p.usuario_id,
          turno_id:        turnoId,
          novedad_id:      novedadId,
          leida:           false,
          resuelta:        false,
        }))
      )
      for (const p of participaciones) {
        sendPushToUser(p.usuario_id, {
          title: pushTitle,
          body:  mensaje.slice(0, 100),
          url:   '/tecnico/libro-guardia',
        }).catch(() => {})
      }
    }
  }
}
