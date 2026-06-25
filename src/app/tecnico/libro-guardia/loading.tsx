import { Skeleton } from '@/components/ui/Skeleton'

export default function LibroGuardiaLoading() {
  return (
    <div className="flex flex-col gap-4 pb-28">
      <Skeleton className="h-7 w-44" />

      {/* Card turno activo */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-5 w-20 rounded-full ml-auto" />
        </div>
        <div className="grid grid-cols-2 gap-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i}>
              <Skeleton className="h-2.5 w-16 mb-1" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>

      {/* Timeline skeleton */}
      <Skeleton className="h-3 w-32 mt-1" />
      <div className="flex flex-col gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <Skeleton className="h-3 w-3 rounded-full mt-1" />
              {i < 2 && <Skeleton className="w-px h-full mt-1" />}
            </div>
            <div className="flex-1 pb-3">
              <Skeleton className="h-3.5 w-20 mb-1" />
              <Skeleton className={`h-3 ${i % 2 === 0 ? 'w-3/4' : 'w-1/2'}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
