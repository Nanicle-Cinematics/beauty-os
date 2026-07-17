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
