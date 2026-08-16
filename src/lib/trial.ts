export const TRIAL_DAYS = 7;
export const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

export function trialEndsAt(start = new Date()) {
  return new Date(start.getTime() + TRIAL_MS);
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

  const endsAt = subscriptionTrialEndsAt ?? trialEndsAt(businessCreatedAt);
  return endsAt.getTime() <= now.getTime();
}
