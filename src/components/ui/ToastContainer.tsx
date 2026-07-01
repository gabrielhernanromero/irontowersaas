'use client'

import { useToast, type Toast, type ToastVariant } from '@/lib/toast/context'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'

const VARIANT_STYLES: Record<ToastVariant, { bar: string; icon: string; bg: string; text: string }> = {
  success: { bar: 'bg-emerald-500', icon: 'text-emerald-600', bg: 'bg-white',      text: 'text-brand-ink'  },
  error:   { bar: 'bg-red-500',     icon: 'text-red-600',     bg: 'bg-red-50',     text: 'text-red-900'    },
  warning: { bar: 'bg-amber-500',   icon: 'text-amber-600',   bg: 'bg-amber-50',   text: 'text-amber-900'  },
  info:    { bar: 'bg-blue-500',    icon: 'text-blue-600',    bg: 'bg-white',      text: 'text-brand-ink'  },
}

const ICONS: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2 size={18} />,
  error:   <XCircle      size={18} />,
  warning: <AlertTriangle size={18} />,
  info:    <Info          size={18} />,
}

function ToastItem({ t, onDismiss }: { t: Toast; onDismiss: () => void }) {
  const s = VARIANT_STYLES[t.variant]
  return (
    <div
      className={`
        flex items-start gap-3 rounded-xl shadow-lg border border-gray-100
        px-4 py-3 min-w-[280px] max-w-[90vw] relative overflow-hidden
        animate-slide-down ${s.bg}
      `}
      role="alert"
    >
      {/* Colored left bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${s.bar} rounded-l-xl`} />
      <span className={`shrink-0 mt-0.5 ${s.icon}`}>{ICONS[t.variant]}</span>
      <p className={`flex-1 text-sm font-medium leading-snug ${s.text}`}>{t.message}</p>
      <button
        onClick={onDismiss}
        className="shrink-0 text-gray-400 hover:text-gray-600 p-0.5 -mr-1 -mt-0.5"
        aria-label="Cerrar"
      >
        <X size={14} />
      </button>
    </div>
  )
}

export default function ToastContainer() {
  const { toasts, dismiss } = useToast()
  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[300] flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem t={t} onDismiss={() => dismiss(t.id)} />
        </div>
      ))}
    </div>
  )
}
