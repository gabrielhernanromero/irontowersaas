import type { Rol } from '@/types/database'

export const ROLE_REDIRECTS: Record<Rol, string> = {
  tecnico: '/tecnico/home',
  supervisor: '/supervisor/dashboard',
  admin: '/supervisor/dashboard',
  cliente: '/login',
}
