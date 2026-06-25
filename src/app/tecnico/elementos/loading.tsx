import { Skeleton, SkeletonListItem } from '@/components/ui/Skeleton'

export default function ElementosLoading() {
  return (
    <div className="flex flex-col gap-4 pb-28">
      <Skeleton className="h-7 w-36" />
      <Skeleton className="h-3 w-48" />
      <div className="flex flex-col gap-2 mt-1">
        {[...Array(6)].map((_, i) => (
          <SkeletonListItem key={i} />
        ))}
      </div>
    </div>
  )
}
