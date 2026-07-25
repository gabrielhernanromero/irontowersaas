import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function supabase(): SupabaseClient {
  if (!_client) {
    _client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      // flowType 'implicit': el link de "olvidé mi contraseña" se valida en el
      // servidor de Supabase antes de redirigir, así que funciona aunque se
      // pida desde un dispositivo y se abra desde otro (PKCE exige el mismo
      // navegador). No afecta signInWithPassword — acá no se usa OAuth ni
      // magic link, así que es el único flujo al que le pega este cambio.
      { auth: { flowType: 'implicit' } }
    )
  }
  return _client
}
