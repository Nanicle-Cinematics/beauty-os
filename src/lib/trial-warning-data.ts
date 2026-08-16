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
 * Invoked by a cron with no signed-in user, so there is no ambient tenant
 * context and RLS is deny-by-default. The ENTIRE job runs inside one withBypass
 * scope rather than wrapping individual queries, because the writes matter as
 * much as the reads: sendEmail records its own NotificationLog row and swallows
 * failures by design, so an unscoped write disappears without a trace and the
 * dedupe it feeds never fires — warning the same owner every single day.
 *
 * Wrapping the whole job also removes the subtler trap. withBypass runs its
 * callback inside AsyncLocalStorage, so a callback that merely *returns*
 * prisma.foo() hands back a lazy PrismaPromise that does not dispatch until it
 * is awaited outside the scope. Every await in here is inside the scope.
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

  return withBypass(async () => {
    const horizon = new Date(now.getTime() + WARN_WITHIN_DAYS * 24 * 60 * 60 * 1000);

    const candidates = await prisma.business.findMany({
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

      const priorWarning = await prisma.notificationLog.findFirst({
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
  });
}
