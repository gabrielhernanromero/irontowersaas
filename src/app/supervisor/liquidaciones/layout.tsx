import { requireRole } from '@/lib/auth/requireRole'
import { Clock } from 'lucide-react'
import LiquidacionesTabs from './LiquidacionesTabs'

export default async function LiquidacionesLayout({ children }: { children: React.ReactNode }) {
  await requireRole('supervisor', 'admin')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-brand-orange/10 flex items-center justify-center">
            <Clock size={22} className="text-brand-orange" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Liquidaciones</h1>
            <p className="text-sm text-gray-500">Horas, feriados y tarifas para liquidar sueldos</p>
          </div>
        </div>
        <LiquidacionesTabs />
      </div>
      {children}
    </div>
  )
}
