import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/getSession'

export async function GET() {
  const { user } = await getSession()

  if (!user) {
    return NextResponse.json({ redirectTo: '/login' })
  }

  const roleRedirects: Record<string, string> = {
    tecnico: '/tecnico/home',
    supervisor: '/supervisor/dashboard',
    admin: '/supervisor/dashboard',
    cliente: '/login',
  }

  return NextResponse.json({
    redirectTo: roleRedirects[user.rol] ?? '/login',
  })
}
