import { Skeleton } from '@/components/ui/Skeleton'

export default function RondaLoading() {
  return (
    <div className="flex flex-col gap-4 pb-28">
      <Skeleton className="h-7 w-28" />

      {/* Card ronda */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <Skeleton className="h-4 w-32 mb-4" />
        <div className="space-y-3">
          <div className="flex justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
        <Skeleton className="h-12 w-full rounded-xl mt-5" />
      </div>

      {/* Puntos de control */}
      <Skeleton className="h-3 w-36" />
      <div className="flex flex-col gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1">
              <Skeleton className="h-3.5 w-32 mb-1" />
              <Skeleton className="h-2.5 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
