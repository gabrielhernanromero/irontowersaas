import { supabaseAdmin } from '@/lib/supabase/admin'
import type { TipoAuthEvento } from '@/types/database'

interface LogAuthEventParams {
  email: string
  evento: TipoAuthEvento
  userId?: string | null
  actorId?: string | null
  ip?: string | null
  userAgent?: string | null
}

export async function logAuthEvent({
  email,
  evento,
  userId = null,
  actorId = null,
  ip = null,
  userAgent = null,
}: LogAuthEventParams): Promise<void> {
  const { error } = await supabaseAdmin().from('auth_events').insert({
    email,
    evento,
    user_id: userId,
    actor_id: actorId,
    ip,
    user_agent: userAgent,
  })

  if (error) console.error('[logAuthEvent] error insertando evento:', error.message)
}

export function getRequestIp(req: Request): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null
}
