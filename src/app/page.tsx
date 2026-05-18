import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/getSession'

export default async function RootPage() {
  const { user } = await getSession()

  if (!user) redirect('/login')

  if (user.rol === 'tecnico') redirect('/tecnico/home')
  if (user.rol === 'supervisor') redirect('/supervisor/dashboard')
  if (user.rol === 'admin') redirect('/supervisor/dashboard')

  redirect('/login')
}
