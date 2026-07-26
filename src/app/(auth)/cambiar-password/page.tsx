import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/getSession'
import CambiarPasswordForm from './CambiarPasswordForm'

// No usa requireRole() a propósito: requireRole() redirige acá cuando
// must_change_password es true, así que usarlo en esta página crearía un loop.
export default async function CambiarPasswordPage() {
  const { user } = await getSession()
  if (!user) redirect('/login')

  return (
    <div className="w-full max-w-sm">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-brand-ink">Elegí tu nueva contraseña</h1>
          <p className="text-brand-muted text-base mt-2">
            Por seguridad, tenés que cambiar la contraseña temporal antes de continuar.
          </p>
        </div>

        <CambiarPasswordForm />
      </div>
    </div>
  )
}
