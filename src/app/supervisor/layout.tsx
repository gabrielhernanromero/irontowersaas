import { requireRole } from '@/lib/auth/requireRole'
import { getSession } from '@/lib/auth/getSession'
import Link from 'next/link'
import { LayoutDashboard, Bell, ClipboardList, FileText, Users, Building2, LogOut } from 'lucide-react'

export default async function SupervisorLayout({ children }: { children: React.ReactNode }) {
  await requireRole('supervisor', 'admin')
  const { user } = await getSession()

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-56 bg-brand-ink text-white min-h-screen">
        <div className="p-5 border-b border-white/10">
          <p className="font-condensed font-bold text-lg">Iron Tower</p>
          <p className="text-xs text-white/60 mt-1">
            {user?.nombre} {user?.apellido}
          </p>
        </div>

        <nav className="flex flex-col gap-1 p-3 flex-1">
          <SideLink href="/supervisor/dashboard" icon={<LayoutDashboard size={18} />} label="Dashboard" />
          <SideLink href="/supervisor/alertas" icon={<Bell size={18} />} label="Alertas" />
          <SideLink href="/supervisor/planillas" icon={<ClipboardList size={18} />} label="Planillas" />
          <SideLink href="/supervisor/informes" icon={<FileText size={18} />} label="Informes" />
          <SideLink href="/supervisor/empresas" icon={<Building2 size={18} />} label="Empresas" />
          <SideLink href="/supervisor/usuarios" icon={<Users size={18} />} label="Técnicos" />
        </nav>

        <div className="p-3 border-t border-white/10">
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="flex items-center gap-2 text-white/60 hover:text-white text-sm w-full p-2 rounded"
            >
              <LogOut size={16} />
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar mobile */}
        <header className="md:hidden bg-brand-ink text-white px-4 py-3 flex items-center justify-between">
          <p className="font-condensed font-bold">Iron Tower</p>
          <p className="text-sm text-white/70">{user?.nombre}</p>
        </header>

        <main className="flex-1 p-4 md:p-6 max-w-6xl w-full mx-auto">{children}</main>

        {/* Bottom nav mobile */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
          <div className="flex">
            <MobileLink href="/supervisor/dashboard" icon={<LayoutDashboard size={20} />} label="Dashboard" />
            <MobileLink href="/supervisor/alertas" icon={<Bell size={20} />} label="Alertas" />
            <MobileLink href="/supervisor/planillas" icon={<ClipboardList size={20} />} label="Planillas" />
            <MobileLink href="/supervisor/informes" icon={<FileText size={20} />} label="Informes" />
            <MobileLink href="/supervisor/empresas" icon={<Building2 size={20} />} label="Empresas" />
            <MobileLink href="/supervisor/usuarios" icon={<Users size={20} />} label="Técnicos" />
          </div>
        </nav>
      </div>
    </div>
  )
}

function SideLink({
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
      className="flex items-center gap-3 px-3 py-2 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors text-sm"
    >
      {icon}
      {label}
    </Link>
  )
}

function MobileLink({
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
      className="flex-1 flex flex-col items-center justify-center gap-1 py-3 min-h-[56px] text-brand-ink text-xs"
    >
      {icon}
      {label}
    </Link>
  )
}
