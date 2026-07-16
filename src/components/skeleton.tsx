// Shimmering placeholder block used by route loading states. Uses the light
// plum tint so it feels on-brand; animate-pulse is neutralized by the global
// prefers-reduced-motion guard.
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-plum-soft/70 ${className}`} />;
}

// A KPI-tile-shaped skeleton row (used by dashboard / reports / finance).
export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-4 gap-4 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="grid gap-3 card p-5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

// A stack of table-row skeletons inside a card.
export function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <div className="card p-5">
      <Skeleton className="mb-4 h-5 w-40" />
      <div className="grid gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    </div>
  );
}
