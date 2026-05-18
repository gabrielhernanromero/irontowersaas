import { supabaseServer } from '@/lib/supabase/server'
import type { User } from '@/types'

export async function getSession(): Promise<{ user: User | null }> {
  const sb = supabaseServer()
  const { data: { user: authUser } } = await sb.auth.getUser()

  if (!authUser) return { user: null }

  const { data } = await sb
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  return { user: data ?? null }
}
