import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PUBLIC_PATHS = ['/login', '/unauthorized', '/api/']

export async function middleware(req: NextRequest) {
  let supabaseResponse = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request: req })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  let user = null
  let authError = null
  try {
    const result = await supabase.auth.getUser()
    user = result.data.user
    authError = result.error
  } catch (e) {
    console.error('[middleware] getUser threw:', e)
  }

  const path = req.nextUrl.pathname
  const allCookies = req.cookies.getAll()
  console.log('[middleware]', path, '| cookies:', allCookies.map(c => c.name).join(', ') || 'NINGUNA', '| user:', user?.email ?? 'null', '| error:', String(authError))

  if (PUBLIC_PATHS.some(p => path.startsWith(p))) return supabaseResponse
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
