import { supabaseAdmin } from '@/lib/supabase/admin'

// Bucket "planos" privado — se resuelve siempre a una signed URL de corta
// duración, nunca a una URL pública permanente (expone el layout del predio).
const SIGNED_URL_TTL_SECONDS = 3600

export async function getPlanoUrl(clienteId: string): Promise<string | null> {
  const admin = supabaseAdmin()

  const { data } = await admin
    .from('planos_planta')
    .select('path')
    .eq('cliente_id', clienteId)
    .maybeSingle()

  if (!data) return null

  const { data: signed } = await admin.storage
    .from('planos')
    .createSignedUrl(data.path, SIGNED_URL_TTL_SECONDS)

  return signed?.signedUrl ?? null
}
