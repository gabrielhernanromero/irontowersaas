import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/getSession'
import { supabaseAdmin } from '@/lib/supabase/admin'

const ROLE_REDIRECTS: Record<string, string> = {
  tecnico:    '/tecnico/home',
  supervisor: '/supervisor/dashboard',
  admin:      '/supervisor/dashboard',
  cliente:    '/login',
}

export async function GET(req: NextRequest) {
  // Mobile: tras signInWithPassword las cookies pueden no estar en la
  // request inmediatamente. Se acepta el token en el header Authorization
  // para evitar esa dependencia de timing.
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (token) {
    const { data: { user: authUser } } = await supabaseAdmin().auth.getUser(token)
    if (authUser) {
      const { data: perfil } = await supabaseAdmin()
        .from('users')
        .select('rol')
        .eq('id', authUser.id)
        .single()
      return NextResponse.json({
        redirectTo: ROLE_REDIRECTS[perfil?.rol ?? ''] ?? '/login',
      })
    }
  }

  // Fallback: sesión por cookie (desktop y sesiones existentes)
  const { user } = await getSession()
  if (!user) return NextResponse.json({ redirectTo: '/login' })

  return NextResponse.json({ redirectTo: ROLE_REDIRECTS[user.rol] ?? '/login' })
}
