import { Skeleton, SkeletonStat, SkeletonCard } from '@/components/ui/Skeleton'

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-7 w-36" />

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <SkeletonStat key={i} />
        ))}
      </div>

      {/* Dos columnas */}
      <div className="grid md:grid-cols-2 gap-4">
        <SkeletonCard rows={4} />
        <SkeletonCard rows={4} />
      </div>

      <SkeletonCard rows={3} />
    </div>
  )
}
