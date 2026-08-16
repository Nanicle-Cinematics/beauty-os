import "server-only";

import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { withBypass } from "@/lib/tenant-context";
import { daysUntilTrialEnd, isOnTrial, resolveTrialEnd } from "@/lib/trial";
import { formatLongDateInTz } from "@/lib/date";
import { sendTrialExpiringEmail } from "@/lib/email";
import { getBaseUrl } from "@/lib/urls";

/** Warn once the trial has this many days or fewer left. */
export const WARN_WITHIN_DAYS = 2;

/**
 * Don't warn the same workspace twice. A trial is seven days, so a fortnight's
 * lookback comfortably covers one trial without suppressing a genuinely new one
 * (an admin can put a business back on trial with a fresh trialEndsAt).
 */
const DEDUPE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Businesses still on trial are unconverted signups, so this set is small and
 * self-limiting. The cap is a guard, not a page — if it is ever hit, the warning
 * has bigger problems than pagination.
 */
const MAX_CANDIDATES = 500;

export type TrialWarningSummary = {
  candidates: number;
  warned: number;
  alreadyWarned: number;
  noRecipient: number;
  failed: number;
  slugs: string[];
};

/**
 * Emails the owners of every workspace whose trial is about to run out.
 *
 * Runs from a cron with no signed-in user, so every read is wrapped in
 * withBypass: RLS is deny-by-default and a query with no tenant GUC returns
 * ZERO rows, which would look exactly like "nobody is expiring" and fail
 * silently forever.
 */
export async function sendExpiringTrialWarnings(now = new Date()): Promise<TrialWarningSummary> {
  const summary: TrialWarningSummary = {
    candidates: 0,
    warned: 0,
    alreadyWarned: 0,
    noRecipient: 0,
    failed: 0,
    slugs: [],
  };

  if (!isDatabaseConfigured()) {
    return summary;
  }

  const horizon = new Date(now.getTime() + WARN_WITHIN_DAYS * 24 * 60 * 60 * 1000);

  // The callback MUST be async with the query awaited inside it. A plain arrow
  // returning prisma.foo() only builds a lazy PrismaPromise — it does not run
  // until the await outside storage.run(), by which point the bypass context is
  // gone and RLS returns zero rows. That failure is silent: the job reports a
  // clean "nobody is expiring" and warns no one, forever.
  const candidates = await withBypass(async () => {
    return await prisma.business.findMany({
      where: {
        status: { in: ["TRIAL", "SUSPENDED"] },
        // A business with no subscription row falls back to createdAt + 7 days,
        // which is not a column, so the exact cut-off is applied in code below.
        // This narrows to plausible rows without trying to express the fallback
        // in SQL — $queryRaw would sidestep the RLS extension entirely.
        OR: [
          { subscription: { is: null } },
          { subscription: { trialEndsAt: { lte: horizon } } },
          { subscription: { trialEndsAt: null } },
        ],
      },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        createdAt: true,
        timezone: true,
        subscription: { select: { status: true, trialEndsAt: true } },
        staff: {
          where: { role: "OWNER", status: "ACTIVE", userId: { not: null } },
          select: { user: { select: { email: true, name: true } } },
        },
      },
      take: MAX_CANDIDATES,
    });
  });

  const baseUrl = await getBaseUrl();

  for (const business of candidates) {
    const subscriptionStatus = business.subscription?.status;

    if (!isOnTrial({ businessStatus: business.status, subscriptionStatus })) {
      continue;
    }

    const endsAt = resolveTrialEnd({
      businessCreatedAt: business.createdAt,
      subscriptionTrialEndsAt: business.subscription?.trialEndsAt,
    });

    // Already lapsed workspaces are past warning — they see the lock screen,
    // which tells them what to do. Warning them now would be noise.
    if (endsAt.getTime() <= now.getTime() || endsAt.getTime() > horizon.getTime()) {
      continue;
    }

    summary.candidates += 1;

    const priorWarning = await withBypass(async () => {
      return await prisma.notificationLog.findFirst({
        where: {
          businessId: business.id,
          type: "trial_expiring",
          // A FAILED attempt must not count as warned, or one bad SMTP moment
          // would silently cost that owner their only notice.
          status: { not: "FAILED" },
          createdAt: { gte: new Date(now.getTime() - DEDUPE_WINDOW_MS) },
        },
        select: { id: true },
      });
    });

    if (priorWarning) {
      summary.alreadyWarned += 1;
      continue;
    }

    const recipients = business.staff.map((member) => member.user).filter((user) => user?.email);
    if (recipients.length === 0) {
      summary.noRecipient += 1;
      continue;
    }

    const daysLeft = daysUntilTrialEnd(endsAt, now);
    const endsOn = formatLongDateInTz(endsAt, business.timezone);
    let sentAny = false;

    for (const user of recipients) {
      if (!user?.email) continue;
      const result = await sendTrialExpiringEmail({
        to: user.email,
        name: user.name,
        businessName: business.name,
        endsOn,
        daysLeft,
        url: `${baseUrl}/${business.slug}`,
        businessId: business.id,
      });
      // sendEmail records its own NotificationLog row either way; this only
      // decides how the run is reported.
      if (result.ok) sentAny = true;
    }

    if (sentAny) {
      summary.warned += 1;
      summary.slugs.push(business.slug);
    } else {
      summary.failed += 1;
    }
  }

  return summary;
}
