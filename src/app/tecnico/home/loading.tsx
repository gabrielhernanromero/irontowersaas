import { Skeleton, SkeletonCard, SkeletonListItem } from '@/components/ui/Skeleton'

export default function HomeLoading() {
  return (
    <div className="flex flex-col gap-4 pb-28">
      {/* Saludo */}
      <div>
        <Skeleton className="h-5 w-40 mb-1" />
        <Skeleton className="h-3.5 w-28" />
      </div>

      {/* Card turno / guardia */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-3.5 w-28" />
        </div>
        <div className="grid grid-cols-2 gap-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i}>
              <Skeleton className="h-2.5 w-16 mb-1" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
        <Skeleton className="h-12 w-full rounded-xl mt-4" />
      </div>

      {/* Sección rondas */}
      <Skeleton className="h-3 w-24" />
      <SkeletonCard rows={2} />

      {/* Sección planillas */}
      <Skeleton className="h-3 w-28 mt-1" />
      <div className="flex flex-col gap-2">
        <SkeletonListItem />
        <SkeletonListItem />
      </div>
    </div>
  )
}
