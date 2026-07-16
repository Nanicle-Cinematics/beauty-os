import { Skeleton, SkeletonStats, SkeletonRows } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="grid gap-5">
      <div className="grid gap-2.5">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <SkeletonStats count={4} />
      {/* trend chart */}
      <div className="card p-5">
        <Skeleton className="mb-4 h-5 w-36" />
        <Skeleton className="h-48 w-full" />
      </div>
      <div className="grid grid-cols-2 gap-5 max-[900px]:grid-cols-1">
        <SkeletonRows rows={5} />
        <SkeletonRows rows={5} />
      </div>
    </div>
  );
}
