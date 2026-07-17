// Pure hold logic, kept out of appointment-data.ts (which is server-only and
// pulls in Prisma) so it can be unit tested directly. See docs/HOLDS.md.

/** How long a hold lives when the caller doesn't specify. */
export const DEFAULT_HOLD_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Default expiry for a new hold: a week out, but never past the appointment
 * itself — a hold that outlives the date it reserves is meaningless.
 */
export function defaultHoldExpiry(startAt: Date, now = new Date()) {
  const week = new Date(now.getTime() + DEFAULT_HOLD_DAYS * DAY_MS);
  return week < startAt ? week : startAt;
}

/**
 * Human label for a hold's expiry, e.g. "expires in 3 days".
 * Null when there's no expiry to describe.
 */
const startOfUtcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export function holdExpiryLabel(expiresAt: Date | null | undefined, now = new Date()) {
  if (!expiresAt) return null;
  if (expiresAt.getTime() <= now.getTime()) return "expired";

  // Calendar days apart, NOT elapsed-millisecond division. The expiry picker is
  // a date input, so it lands on UTC midnight: a date chosen 3 days out is only
  // ~2.5 days away, and dividing would report "2 days" for a Friday deadline
  // picked on Tuesday. Whole-day multiples hide this — see holds.test.ts.
  const days = Math.round((startOfUtcDay(expiresAt) - startOfUtcDay(now)) / DAY_MS);
  if (days <= 0) return "expires today";
  return `expires in ${days} day${days === 1 ? "" : "s"}`;
}

/** A hold is stale once its expiry has passed. Soft signal — staff may still confirm it. */
export function isHoldExpired(expiresAt: Date | null | undefined, now = new Date()) {
  return expiresAt != null && expiresAt.getTime() <= now.getTime();
}

/* ---- the ladder ---------------------------------------------------------- */

/**
 * Where a new hold joins the queue for a contended slot: behind everyone already
 * holding it. Priorities may be sparse or null (older rows predate the ladder),
 * so this reads the high-water mark rather than counting rows.
 */
export function nextHoldPriority(existing: (number | null | undefined)[]) {
  const highest = existing.reduce<number>((max, p) => (p != null && p > max ? p : max), 0);
  return highest + 1;
}

export type LadderEntry = { id: string; holdPriority: number | null };
export type Promotion = { id: string; priority: number; becomesFirst: boolean };

/**
 * When a hold leaves the ladder, everyone behind it moves up one.
 *
 * Only holds strictly behind `removedPriority` shift — those ahead are
 * unaffected. `becomesFirst` marks whoever inherits the front of the queue, the
 * only client worth emailing: they're the one who can now actually have the date.
 */
export function promoteLadder(holds: LadderEntry[], removedPriority: number): Promotion[] {
  return holds
    .filter((h) => h.holdPriority != null && h.holdPriority > removedPriority)
    .map((h) => {
      const priority = h.holdPriority! - 1;
      return { id: h.id, priority, becomesFirst: priority === 1 };
    });
}

export function ordinal(n: number) {
  const teens = n % 100;
  if (teens >= 11 && teens <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** UI chip for a hold's place in the queue. Null when it isn't queued behind anyone. */
export function holdQueueLabel(priority: number | null | undefined) {
  if (priority == null || priority < 1) return null;
  return `${ordinal(priority)} in line`;
}
