import { Skeleton, SkeletonRows, SkeletonStats } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <SkeletonStats count={3} />
      <SkeletonRows rows={7} />
    </div>
  );
}
