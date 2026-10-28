import "server-only";

import { cache } from "react";

import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { isOnTrial } from "@/lib/trial";
import {
  MODULE_LABEL,
  SEAT_HOLDING_STATUSES,
  TOP_PLAN,
  hasModule,
  lockedModulesFor,
  nextPlanUp,
  planRequiredFor,
  resolvePlan,
  seatLimit,
  seatsExhausted,
  type ModuleKey,
  type PlanKey,
} from "@/lib/entitlements";

export type WorkspaceEntitlement = {
  /** The plan actually assigned, or null when no subscription row exists. */
  assignedPlan: PlanKey | null;
  assignedPlanName: string | null;
  /** The plan we serve at — trials and unassigned workspaces are served the top tier. */
  plan: PlanKey;
  onTrial: boolean;
  lockedModules: ModuleKey[];
  seatLimit: number | null;
  /** Staff holding a seat: everyone on the team except removed members. */
  seatsUsed: number;
  upgradeTo: PlanKey | null;
  upgradeToName: string | null;
};

/**
 * What this workspace may open.
 *
 * Cached per request: the tenant layout asks once to build the nav, and then
 * every server action on the page asks again to guard itself. Without the dedupe
 * that is a fresh pair of queries per action on a plan that cannot change
 * mid-request.
 */
export const getWorkspaceEntitlement = cache(async function getWorkspaceEntitlement(
  businessSlug: string,
): Promise<WorkspaceEntitlement> {
  if (!isDatabaseConfigured()) {
    return unlimited();
  }

  const business = await prisma.business.findUnique({
    where: { slug: businessSlug },
    select: {
      status: true,
      createdAt: true,
      subscription: { select: { status: true, plan: { select: { key: true, name: true } } } },
      _count: { select: { staff: { where: { status: { in: [...SEAT_HOLDING_STATUSES] } } } } },
    },
  });

  // A workspace we cannot read is not a workspace we should punish. The tenant
  // guards decide who gets in; this only decides what they see once inside.
  if (!business) {
    return unlimited();
  }

  const onTrial = isOnTrial({
    businessStatus: business.status,
    subscriptionStatus: business.subscription?.status,
  });

  const assignedPlan = business.subscription?.plan.key ?? null;
  const plan = resolvePlan({ planKey: assignedPlan, onTrial });
  const upgradeTo = nextPlanUp(plan);

  const upgradeToName = upgradeTo
    ? (await prisma.plan.findUnique({ where: { key: upgradeTo }, select: { name: true } }))?.name ?? null
    : null;

  return {
    assignedPlan,
    assignedPlanName: business.subscription?.plan.name ?? null,
    plan,
    onTrial,
    lockedModules: lockedModulesFor(plan),
    seatLimit: seatLimit(plan),
    seatsUsed: business._count.staff,
    upgradeTo,
    upgradeToName,
  };
});

function unlimited(): WorkspaceEntitlement {
  return {
    assignedPlan: null,
    assignedPlanName: null,
    plan: TOP_PLAN,
    onTrial: false,
    lockedModules: [],
    seatLimit: null,
    seatsUsed: 0,
    upgradeTo: null,
    upgradeToName: null,
  };
}

/** Whether this workspace may open a given module right now. */
export async function workspaceHasModule(businessSlug: string, module: ModuleKey) {
  const entitlement = await getWorkspaceEntitlement(businessSlug);
  return hasModule(entitlement.plan, module);
}

/** Whether this workspace has a free staff seat left, and the numbers behind it. */
export async function workspaceSeatState(businessSlug: string) {
  const entitlement = await getWorkspaceEntitlement(businessSlug);
  return {
    exhausted: seatsExhausted(entitlement.plan, entitlement.seatsUsed),
    limit: entitlement.seatLimit,
    used: entitlement.seatsUsed,
  };
}

/** Message shown when a plan blocks something, phrased as an upgrade rather than a refusal. */
export function moduleLockedMessage(module: ModuleKey, upgradeToName?: string | null) {
  const target = upgradeToName ?? planRequiredFor(module).toLowerCase();
  return `${MODULE_LABEL[module]} is not included in your plan. Upgrade to ${target} to unlock it.`;
}
