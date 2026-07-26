import { redirect } from 'next/navigation'
import { getSession } from './getSession'
import type { Rol, User } from '@/types'

export async function requireRole(...roles: Rol[]): Promise<User> {
  const { user } = await getSession()

  if (!user || !user.activo) redirect('/login')
  if (user.must_change_password) redirect('/cambiar-password')
  if (!roles.includes(user.rol)) redirect('/unauthorized')

  return user
}
