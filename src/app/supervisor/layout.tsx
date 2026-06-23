import { requireRole } from '@/lib/auth/requireRole'
import { getSession } from '@/lib/auth/getSession'
import Link from 'next/link'
import { LayoutDashboard, Bell, ClipboardList, FileText, Users, Target, ClipboardCheck, CalendarDays, ShieldCheck } from 'lucide-react'
import PushNotificationSetup from '@/components/PushNotificationSetup'
import OfflineBanner from '@/components/OfflineBanner'
import ThemeToggle from '@/components/ui/ThemeToggle'
import LogoutButton from '@/components/ui/LogoutButton'

export default async function SupervisorLayout({ children }: { children: React.ReactNode }) {
  await requireRole('supervisor', 'admin')
  const { user } = await getSession()
  const esAdmin = user?.rol === 'admin'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      <OfflineBanner />
      <PushNotificationSetup />
      {/* Sidebar desktop */}
      <aside className="hidden md:flex print:hidden flex-col w-56 bg-brand-ink dark:bg-gray-950 text-white min-h-screen">
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
          <SideLink href="/supervisor/clientes" icon={<Target size={18} />} label="Clientes" />
          <SideLink href="/supervisor/turnos"    icon={<CalendarDays size={18} />} label="Turnos" />
          <SideLink href="/supervisor/rondas"   icon={<ClipboardCheck size={18} />} label="Rondas" />
          <SideLink href="/supervisor/usuarios" icon={<Users size={18} />} label="Técnicos" />
          {esAdmin && (
            <SideLink href="/supervisor/supervisores" icon={<ShieldCheck size={18} />} label="Supervisores" />
          )}
        </nav>

        <div className="p-3 border-t border-white/10 space-y-1">
          <ThemeToggle />
          <LogoutButton />
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar mobile */}
        <header className="md:hidden print:hidden bg-brand-ink dark:bg-gray-950 text-white px-4 py-3 flex items-center justify-between">
          <p className="font-condensed font-bold">Iron Tower</p>
          <p className="text-sm text-white/70">{user?.nombre}</p>
        </header>

        <main className="flex-1 p-4 md:p-6 max-w-6xl w-full mx-auto">{children}</main>

        {/* Bottom nav mobile */}
        <nav className="md:hidden print:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
          <div className="flex">
            <MobileLink href="/supervisor/dashboard" icon={<LayoutDashboard size={20} />} label="Dashboard" />
            <MobileLink href="/supervisor/alertas" icon={<Bell size={20} />} label="Alertas" />
            <MobileLink href="/supervisor/planillas" icon={<ClipboardList size={20} />} label="Planillas" />
            <MobileLink href="/supervisor/informes" icon={<FileText size={20} />} label="Informes" />
            <MobileLink href="/supervisor/clientes" icon={<Target size={20} />} label="Clientes" />
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
      className="flex-1 flex flex-col items-center justify-center gap-1 py-3 min-h-[56px] text-brand-ink dark:text-gray-300 text-xs"
    >
      {icon}
      {label}
    </Link>
  )
}
