import { Skeleton, SkeletonStats } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="grid gap-5">
      <div className="grid gap-2.5">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <SkeletonStats count={4} />
      <div className="grid gap-5">
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}
