import webpush from 'web-push'
import { supabaseAdmin } from '@/lib/supabase/admin'

function initVapid() {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )
}

export interface PushPayload {
  title: string
  body:  string
  url?:  string
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!process.env.VAPID_PRIVATE_KEY) return // notificaciones no configuradas

  initVapid()

  const { data: subs } = await supabaseAdmin()
    .from('push_subscriptions')
    .select('id, endpoint, subscription')
    .eq('user_id', userId)

  if (!subs?.length) return

  const expirados: string[] = []

  await Promise.allSettled(
    subs.map(async ({ id, subscription }) => {
      try {
        await webpush.sendNotification(
          subscription as webpush.PushSubscription,
          JSON.stringify(payload),
        )
      } catch (err: unknown) {
        // 410 Gone = suscripción expirada, limpiar
        if ((err as { statusCode?: number })?.statusCode === 410) {
          expirados.push(id)
        }
      }
    }),
  )

  if (expirados.length) {
    await supabaseAdmin()
      .from('push_subscriptions')
      .delete()
      .in('id', expirados)
  }
}
