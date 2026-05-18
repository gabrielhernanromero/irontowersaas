import { redirect } from 'next/navigation'
import { getSession } from './getSession'
import type { Rol, User } from '@/types'

export async function requireRole(...roles: Rol[]): Promise<User> {
  const { user } = await getSession()

  if (!user || !user.activo) redirect('/login')
  if (!roles.includes(user.rol)) redirect('/unauthorized')

  return user
}
