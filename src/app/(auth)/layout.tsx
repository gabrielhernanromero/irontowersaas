import { ForceLightMode } from '@/components/ForceLightMode'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-dark px-4">
      <ForceLightMode />
      {children}
    </div>
  )
}
