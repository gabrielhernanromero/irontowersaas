'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/supervisor/personal/horas', label: 'Horas trabajadas' },
  { href: '/supervisor/personal/feriados', label: 'Feriados' },
  { href: '/supervisor/personal/tarifas', label: 'Tarifas' },
]

export default function PersonalTabs() {
  const pathname = usePathname()

  return (
    <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
      {TABS.map((tab) => {
        const activo = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-3 min-h-[44px] text-base font-medium border-b-2 -mb-px whitespace-nowrap ${
              activo
                ? 'border-brand-orange text-brand-orange'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
