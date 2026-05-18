import { requireRole } from '@/lib/auth/requireRole'
import LibroGuardiaForm from '@/components/forms/LibroGuardiaForm'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function NuevaEntradaLibroPage() {
  await requireRole('tecnico', 'admin')

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/tecnico/libro-guardia" className="p-2 -ml-2 text-gray-500">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-condensed font-bold text-brand-ink">
          Nueva entrada
        </h1>
      </div>
      <LibroGuardiaForm />
    </div>
  )
}
