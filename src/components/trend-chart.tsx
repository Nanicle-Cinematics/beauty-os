"use client";

import { useId, useState } from "react";

export type TrendPoint = { label: string; value: number; display: string };
export type TrendSeries = { name: string; color: string; points: TrendPoint[] };

// Lightweight, dependency-free interactive line/area chart. Hover or focus a
// column to see exact values; supports one or more series (e.g. revenue vs
// expenses). SVG draws the line/area (crisp via non-scaling-stroke); dots,
// hover zones, and the tooltip are HTML so nothing distorts when it scales.
export function TrendChart({
  series,
  height = 200,
  ariaLabel,
}: {
  series: TrendSeries[];
  height?: number;
  ariaLabel?: string;
}) {
  const gradId = useId();
  const [active, setActive] = useState<number | null>(null);

  const labels = series[0]?.points.map((p) => p.label) ?? [];
  const n = labels.length;
  const maxY = Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.value))) * 1.12;

  const xPct = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
  const yPct = (v: number) => 100 - (v / maxY) * 100;

  if (n === 0) {
    return <div className="grid h-40 place-items-center text-sm text-muted">No data yet</div>;
  }

  return (
    <div>
      <div className="relative w-full" style={{ height }}>
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <defs>
            {series.map((s, si) => (
              <linearGradient key={si} id={`${gradId}-${si}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {series.map((s, si) => {
            const line = s.points.map((p, i) => `${i ? "L" : "M"}${xPct(i)},${yPct(p.value)}`).join(" ");
            const area = `M${xPct(0)},100 ${s.points.map((p, i) => `L${xPct(i)},${yPct(p.value)}`).join(" ")} L${xPct(n - 1)},100 Z`;
            return (
              <g key={si}>
                <path d={area} fill={`url(#${gradId}-${si})`} />
                <path d={line} fill="none" stroke={s.color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
              </g>
            );
          })}
        </svg>

        {/* dots (HTML so they stay circular) */}
        {series.map((s, si) =>
          s.points.map((p, i) => (
            <span
              key={`${si}-${i}`}
              className="pointer-events-none absolute rounded-full border-2 border-card transition-all"
              style={{
                left: `${xPct(i)}%`,
                top: `${yPct(p.value)}%`,
                width: active === i ? 11 : 7,
                height: active === i ? 11 : 7,
                background: s.color,
                transform: "translate(-50%, -50%)",
                opacity: active === null || active === i ? 1 : 0.5,
              }}
            />
          )),
        )}

        {/* hover / focus zones + tooltip */}
        <div className="absolute inset-0 flex" role="img" aria-label={ariaLabel}>
          {labels.map((label, i) => (
            <div
              key={i}
              tabIndex={0}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="h-full flex-1 outline-none focus-visible:bg-plum/[0.06]"
              aria-label={`${label}: ${series.map((s) => `${s.name} ${s.points[i]?.display}`).join(", ")}`}
            />
          ))}

          {active !== null ? (
            <div
              className="pointer-events-none absolute top-1 z-10 w-max max-w-[180px] rounded-[18px] border border-white/60 bg-white/50 px-3 py-2 shadow-[var(--shadow-lift)]"
              style={{
                left: `${xPct(active)}%`,
                transform: `translateX(${active === 0 ? "0" : active === n - 1 ? "-100%" : "-50%"})`,
              }}
            >
              <div className="text-[11px] font-semibold text-muted">{labels[active]}</div>
              {series.map((s, si) => (
                <div key={si} className="mt-0.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
                  <span className="size-2 rounded-full" style={{ background: s.color }} />
                  {series.length > 1 ? <span className="text-muted">{s.name}</span> : null}
                  {s.points[active]?.display}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* x-axis labels */}
      <div className="mt-2 flex">
        {labels.map((label, i) => (
          <div key={i} className={`flex-1 text-center text-[11px] ${active === i ? "font-semibold text-plum" : "font-medium text-muted"}`}>
            {label}
          </div>
        ))}
      </div>

      {series.length > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-4">
          {series.map((s, si) => (
            <span key={si} className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted">
              <span className="size-2.5 rounded-full" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
