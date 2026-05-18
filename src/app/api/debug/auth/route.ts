import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(req: NextRequest) {
  const allCookies = req.cookies.getAll()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll() {},
      },
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser()

  return NextResponse.json({
    cookies: allCookies.map(c => ({ name: c.name, len: c.value.length })),
    user: user ? { email: user.email, rol: user.user_metadata?.rol } : null,
    error: error?.message ?? null,
  })
}
