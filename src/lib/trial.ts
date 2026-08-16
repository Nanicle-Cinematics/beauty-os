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
  if (businessStatus !== "TRIAL" && subscriptionStatus !== "TRIALING") {
    return false;
  }

  const endsAt = subscriptionTrialEndsAt ?? trialEndsAt(businessCreatedAt);
  return endsAt.getTime() <= now.getTime();
}
