interface SkeletonProps {
  className?: string
}

function cx(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cx('animate-pulse rounded-lg bg-gray-200', className)} />
  )
}

// Skeleton de tarjeta genérica
export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <Skeleton className="h-4 w-1/3 mb-3" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className={`h-3 ${i === rows - 1 ? 'w-2/3' : 'w-full'}`} />
        ))}
      </div>
    </div>
  )
}

// Skeleton de ítem de lista con ícono
export function SkeletonListItem() {
  return (
    <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <Skeleton className="h-9 w-9 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-4 w-4 shrink-0" />
    </div>
  )
}

// Skeleton de stat/número grande (para dashboards)
export function SkeletonStat() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <Skeleton className="h-3 w-1/2 mb-2" />
      <Skeleton className="h-8 w-1/3" />
    </div>
  )
}
