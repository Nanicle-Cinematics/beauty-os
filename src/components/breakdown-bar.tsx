"use client";

import { useState } from "react";

// Interactive progress bar for ranked breakdowns (top services, staff, expense
// categories). Brightens on hover/focus and reveals a tooltip with the exact
// figures; being focusable with an aria-label also makes these previously
// decorative bars readable by screen readers. The -my-1/py-1 enlarges the hit
// area without shifting layout.
export function BreakdownBar({
  share,
  detail,
  tone = "plum",
}: {
  share: number;
  detail: string;
  tone?: "plum" | "warning";
}) {
  const [active, setActive] = useState(false);

  const fill =
    tone === "warning"
      ? active
        ? "bg-gradient-to-r from-warning to-gold"
        : "bg-warning"
      : active
        ? "bg-gradient-to-r from-wine via-plum to-rose"
        : "bg-gradient-to-r from-plum to-mauve";

  return (
    <div className="relative">
      <div
        tabIndex={0}
        role="img"
        aria-label={detail}
        onMouseEnter={() => setActive(true)}
        onMouseLeave={() => setActive(false)}
        onFocus={() => setActive(true)}
        onBlur={() => setActive(false)}
        className="-my-1 cursor-default rounded-full py-1 outline-none"
      >
        <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
          <div className={`h-full rounded-full transition-all duration-300 ${fill}`} style={{ width: `${Math.max(share, 3)}%` }} />
        </div>
      </div>
      {active ? (
        <div className="pointer-events-none absolute -top-7 left-0 z-10 whitespace-nowrap rounded-lg border border-line bg-card px-2.5 py-1 text-[11.5px] font-semibold text-ink shadow-[var(--shadow-lift)]">
          {detail}
        </div>
      ) : null}
    </div>
  );
}
