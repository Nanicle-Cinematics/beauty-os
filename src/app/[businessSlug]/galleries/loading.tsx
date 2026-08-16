import { Skeleton, SkeletonRows, SkeletonStats } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <SkeletonStats count={4} />
      <Skeleton className="h-44" />
      <SkeletonRows rows={4} />
    </div>
  );
}
