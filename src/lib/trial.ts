export const TRIAL_DAYS = 7;
export const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

export function trialEndsAt(start = new Date()) {
  return new Date(start.getTime() + TRIAL_MS);
}

/**
 * When this workspace's trial runs out. The subscription's own date wins; a
 * business with no subscription row falls back to seven days from signup.
 *
 * Shared by the lock gate and the expiry warning on purpose — if these two ever
 * computed the date differently we would warn people about the wrong day, or
 * lock them without having warned them at all.
 */
export function resolveTrialEnd({
  businessCreatedAt,
  subscriptionTrialEndsAt,
}: {
  businessCreatedAt: Date;
  subscriptionTrialEndsAt?: Date | null;
}) {
  return subscriptionTrialEndsAt ?? trialEndsAt(businessCreatedAt);
}

/** Whether a workspace is still on a trial at all (an explicit activation ends it). */
export function isOnTrial({
  businessStatus,
  subscriptionStatus,
}: {
  businessStatus: string;
  subscriptionStatus?: string | null;
}) {
  if (businessStatus === "ACTIVE" || subscriptionStatus === "ACTIVE") return false;
  return businessStatus === "TRIAL" || subscriptionStatus === "TRIALING";
}

export function isTrialExpired({
  businessStatus,
  businessCreatedAt,
  subscriptionStatus,
  subscriptionTrialEndsAt,
  now = new Date(),
}: {
  businessStatus: string;
  businessCreatedAt: Date;
  subscriptionStatus?: string | null;
  subscriptionTrialEndsAt?: Date | null;
  now?: Date;
}) {
  // An explicit activation on either side means this workspace is no longer on
  // a trial, so the trial gate must not hold it. Without this, a stale TRIALING
  // subscription left behind by an earlier plan change outranked an admin
  // setting the business ACTIVE, and the workspace stayed locked with no way
  // out of it from the platform UI.
  if (businessStatus === "ACTIVE" || subscriptionStatus === "ACTIVE") {
    return false;
  }

  if (businessStatus !== "TRIAL" && subscriptionStatus !== "TRIALING") {
    return false;
  }

  return resolveTrialEnd({ businessCreatedAt, subscriptionTrialEndsAt }).getTime() <= now.getTime();
}

/** Whole days from `now` until the trial ends; 0 once it has run out. */
export function daysUntilTrialEnd(endsAt: Date, now = new Date()) {
  return Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
}
