import Link from 'next/link'

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-light-bg px-4">
      <div className="text-center max-w-sm">
        <h1 className="text-2xl font-bold text-brand-dark font-condensed mb-2">
          Sin permisos
        </h1>
        <p className="text-brand-muted mb-6">
          No tenés acceso a esta sección.
        </p>
        <Link
          href="/login"
          className="inline-block py-3 px-6 bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold rounded-lg transition-colors"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
