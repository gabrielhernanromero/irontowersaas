import { requireRole } from '@/lib/auth/requireRole'
import Link from 'next/link'
import { Home, Package, BookOpen } from 'lucide-react'
import { LogoutButton } from './LogoutButton'

export default async function TecnicoLayout({ children }: { children: React.ReactNode }) {
  await requireRole('tecnico', 'admin')

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-[430px] mx-auto pb-20 px-4 pt-4">{children}</main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="max-w-[430px] mx-auto flex">
          <NavItem href="/tecnico/home"      icon={<Home    size={22} />} label="Inicio"    />
          <NavItem href="/tecnico/elementos" icon={<Package size={22} />} label="Elementos" />
          <NavItem href="/tecnico/libro-guardia" icon={<BookOpen size={22} />} label="Guardia" />
          <LogoutButton />
        </div>
      </nav>
    </div>
  )
}

function NavItem({
  href,
  icon,
  label,
}: {
  href: string
  icon: React.ReactNode
  label: string
}) {
  return (
    <Link
      href={href}
      className="flex-1 flex flex-col items-center justify-center gap-1 py-3 min-h-[56px] text-brand-ink hover:text-brand-orange transition-colors"
    >
      {icon}
      <span className="text-xs">{label}</span>
    </Link>
  )
}
