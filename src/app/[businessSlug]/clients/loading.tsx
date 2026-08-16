import { Skeleton, SkeletonRows, SkeletonStats } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-11 w-32" />
      </div>
      <SkeletonStats count={3} />
      <SkeletonRows rows={8} />
    </div>
  );
}
