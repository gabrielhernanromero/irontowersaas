import { createClient } from '@supabase/supabase-js'

// Solo usar en Route Handlers del servidor. Bypasea RLS.
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
