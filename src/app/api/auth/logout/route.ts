import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  await supabaseServer().auth.signOut()
  const origin = req.nextUrl.origin
  return NextResponse.redirect(new URL('/login', origin))
}
