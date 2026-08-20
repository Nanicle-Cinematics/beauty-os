import "server-only";

import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { money } from "@/lib/format";
import { getWorkspaceEntitlement } from "@/lib/entitlement-data";
import {
  PLAN_ORDER,
  PLAN_RANK,
  planFeatureList,
  seatLimit,
  type ModuleKey,
  type PlanKey,
} from "@/lib/entitlements";

export type UpgradeOptions = {
  businessName: string;
  currentPlanName: string;
  currentPrice: string | null;
  currentFeatures: string[];
  onTrial: boolean;
  lockedModules: ModuleKey[];
  seatsUsed: number;
  seatLimit: number | null;
  upgrade: {
    key: PlanKey;
    name: string;
    priceMonthly: string;
    features: string[];
    seatLimit: number | null;
  } | null;
};

/**
 * What this workspace is on, and the one plan worth selling it next.
 *
 * Only one upgrade is offered rather than a full price grid: the tenant already
 * knows what it pays, and a single concrete next step converts better than a
 * comparison table it has to read twice.
 */
export async function getUpgradeOptions(businessSlug: string): Promise<UpgradeOptions> {
  const entitlement = await getWorkspaceEntitlement(businessSlug);

  if (!isDatabaseConfigured()) {
    return {
      businessName: businessSlug,
      currentPlanName: "Full access",
      currentPrice: null,
      currentFeatures: planFeatureList(entitlement.plan),
      onTrial: entitlement.onTrial,
      lockedModules: [],
      seatsUsed: 0,
      seatLimit: null,
      upgrade: null,
    };
  }

  const [business, plans] = await Promise.all([
    prisma.business.findUnique({ where: { slug: businessSlug }, select: { name: true, currency: true } }),
    prisma.plan.findMany({
      where: { isActive: true },
      select: { key: true, name: true, priceMonthly: true },
    }),
  ]);

  const currency = business?.currency ?? "GHS";
  const byKey = new Map(plans.map((p) => [p.key as PlanKey, p]));

  // The plan named on the page is the one they actually pay for. A trial is
  // served the top tier, but calling that "Enterprise" would be a lie — say
  // Trial, and let the trial banner explain it.
  const currentPlanName = entitlement.onTrial
    ? "your free trial"
    : entitlement.assignedPlanName ?? "your current plan";

  const currentPrice =
    !entitlement.onTrial && entitlement.assignedPlan
      ? (() => {
          const row = byKey.get(entitlement.assignedPlan);
          return row ? money(Number(row.priceMonthly), currency) : null;
        })()
      : null;

  return {
    businessName: business?.name ?? businessSlug,
    currentPlanName,
    currentPrice,
    currentFeatures: planFeatureList(entitlement.plan, previousPlanName(entitlement.plan, byKey)),
    onTrial: entitlement.onTrial,
    lockedModules: entitlement.lockedModules,
    seatsUsed: entitlement.seatsUsed,
    seatLimit: entitlement.seatLimit,
    upgrade: resolveUpgrade(entitlement.upgradeTo, byKey, currency),
  };
}

function resolveUpgrade(
  upgradeTo: PlanKey | null,
  byKey: Map<PlanKey, { key: string; name: string; priceMonthly: { toString(): string } }>,
  currency: string,
) {
  if (!upgradeTo) return null;

  // Only two of the four plan keys are actually seeded. Offering an upgrade to a
  // tier that does not exist in the catalogue would send someone to email us
  // about a product we cannot sell them, so skip upward to the next real one.
  const candidates = PLAN_ORDER.filter((p) => PLAN_RANK[p] >= PLAN_RANK[upgradeTo]);
  const target = candidates.find((p) => byKey.has(p));
  if (!target) return null;

  const row = byKey.get(target)!;
  return {
    key: target,
    name: row.name,
    priceMonthly: money(Number(row.priceMonthly), currency),
    features: planFeatureList(target, previousPlanName(target, byKey)),
    seatLimit: seatLimit(target),
  };
}

/** Name of the cheapest seeded plan below this one, for the "Everything in …" line. */
function previousPlanName(plan: PlanKey, byKey: Map<PlanKey, { name: string }>): string | null {
  const below = PLAN_ORDER.filter((p) => PLAN_RANK[p] < PLAN_RANK[plan] && byKey.has(p));
  const nearest = below[below.length - 1];
  return nearest ? byKey.get(nearest)!.name : null;
}
