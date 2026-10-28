/**
 * What a plan actually buys.
 *
 * Until now `Plan.features` and `Plan.limits` were JSON columns that nothing
 * read — every tier granted identical access to all fifteen modules, so the
 * pricing page described a ladder the product did not have. This file is the
 * single source of truth for that ladder, and both the enforcement and the
 * marketing copy are derived from it, so the two can no longer drift apart.
 * (They already had once: Growth Suite listed Marketing while the dearer Studio
 * Pro did not, making the upgrade look like a downgrade.)
 *
 * Deliberately pure — no `server-only`, no Prisma — so the whole ladder is unit
 * testable and can be rendered on public pages that have no tenant.
 */

export type PlanKey = "STARTER" | "PROFESSIONAL" | "STUDIO" | "ENTERPRISE";

/**
 * Tiers are ranked, and a module is unlocked by *reaching* its minimum rank.
 * Access is therefore cumulative by construction: a dearer plan can never be
 * missing something a cheaper one has. That superset property is the thing that
 * broke by hand before, so it is structural here rather than maintained.
 */
export const PLAN_RANK: Record<PlanKey, number> = {
  STARTER: 0,
  PROFESSIONAL: 1,
  STUDIO: 2,
  ENTERPRISE: 3,
};

export const PLAN_ORDER: readonly PlanKey[] = ["STARTER", "PROFESSIONAL", "STUDIO", "ENTERPRISE"];

/** The most generous tier — what a trial and an unassigned workspace both get. */
export const TOP_PLAN: PlanKey = "ENTERPRISE";

/** One key per navigable module; these match the route segment under /[businessSlug]. */
export type ModuleKey =
  | "dashboard"
  | "calendar"
  | "appointments"
  | "waitlist"
  | "clients"
  | "services"
  | "staff"
  | "marketing"
  | "payments"
  | "invoices"
  | "inventory"
  | "galleries"
  | "finance"
  | "reports"
  | "ai-insights"
  | "settings";

/**
 * The cheapest plan that includes each module.
 *
 * Dashboard and settings are STARTER on purpose: a workspace must always be able
 * to see its own state and correct its own details, whatever it pays. Locking
 * settings would also lock the page that explains how to upgrade.
 *
 * The two paid steps mirror what the plans have always claimed in writing:
 * Growth Suite runs the book (calendar, clients, staff, marketing), Studio Pro
 * adds everything that touches money, stock or storage.
 */
export const MODULE_MIN_PLAN: Record<ModuleKey, PlanKey> = {
  dashboard: "STARTER",
  settings: "STARTER",
  calendar: "STARTER",
  appointments: "STARTER",
  clients: "STARTER",
  services: "STARTER",
  staff: "STARTER",

  waitlist: "PROFESSIONAL",
  marketing: "PROFESSIONAL",

  // Everything below costs us money to run per tenant — card records and
  // invoices to store, R2 storage for galleries, OpenAI calls for insights — so
  // it sits on the tier that pays for it.
  payments: "STUDIO",
  invoices: "STUDIO",
  inventory: "STUDIO",
  galleries: "STUDIO",
  finance: "STUDIO",
  reports: "STUDIO",
  "ai-insights": "STUDIO",
};

/** Staff seats a plan may fill; null is unlimited. Mirrors `Plan.limits.staffSeats`. */
export const PLAN_SEATS: Record<PlanKey, number | null> = {
  STARTER: 2,
  PROFESSIONAL: 4,
  STUDIO: 8,
  ENTERPRISE: null,
};

export const MODULE_LABEL: Record<ModuleKey, string> = {
  dashboard: "Dashboard",
  calendar: "Calendar",
  appointments: "Appointments",
  waitlist: "Waitlist",
  clients: "Clients",
  services: "Services",
  staff: "Staff",
  marketing: "Marketing",
  payments: "Payments",
  invoices: "Invoices",
  inventory: "Inventory",
  galleries: "Galleries",
  finance: "Finance",
  reports: "Reports",
  "ai-insights": "AI Insights",
  settings: "Business settings",
};

/**
 * How the ladder is described on the pricing page and in settings.
 *
 * A group's tier is the dearest of its modules, so a bullet can never promise
 * something the plan does not actually unlock.
 */
const FEATURE_GROUPS: readonly { label: string; modules: readonly ModuleKey[] }[] = [
  { label: "Bookings & calendar", modules: ["calendar", "appointments"] },
  { label: "Client CRM", modules: ["clients"] },
  { label: "Staff & services", modules: ["staff", "services"] },
  { label: "Waitlists & holds", modules: ["waitlist"] },
  { label: "Marketing & loyalty", modules: ["marketing"] },
  { label: "Payments & invoicing", modules: ["payments", "invoices"] },
  { label: "Inventory & stock control", modules: ["inventory"] },
  { label: "Client galleries", modules: ["galleries"] },
  { label: "Finance, reports & AI insights", modules: ["finance", "reports", "ai-insights"] },
];

function groupRank(group: (typeof FEATURE_GROUPS)[number]) {
  return Math.max(...group.modules.map((m) => PLAN_RANK[MODULE_MIN_PLAN[m]]));
}

export function isPlanKey(value: unknown): value is PlanKey {
  return typeof value === "string" && value in PLAN_RANK;
}

/**
 * The plan a workspace is actually served at.
 *
 * Two deliberate generosities. A workspace still on trial gets the top tier —
 * a trial that hides the features it is meant to sell is pointless. And a
 * workspace with no subscription row gets the top tier too: missing billing data
 * must never quietly cost a paying salon its modules. Access is only ever
 * narrowed by someone explicitly assigning a cheaper plan.
 */
export function resolvePlan({
  planKey,
  onTrial = false,
}: {
  planKey?: PlanKey | string | null;
  onTrial?: boolean;
}): PlanKey {
  if (onTrial) return TOP_PLAN;
  if (!isPlanKey(planKey)) return TOP_PLAN;
  return planKey;
}

export function hasModule(plan: PlanKey, module: ModuleKey) {
  return PLAN_RANK[plan] >= PLAN_RANK[MODULE_MIN_PLAN[module]];
}

export function modulesFor(plan: PlanKey): ModuleKey[] {
  return (Object.keys(MODULE_MIN_PLAN) as ModuleKey[]).filter((m) => hasModule(plan, m));
}

export function lockedModulesFor(plan: PlanKey): ModuleKey[] {
  return (Object.keys(MODULE_MIN_PLAN) as ModuleKey[]).filter((m) => !hasModule(plan, m));
}

export function seatLimit(plan: PlanKey) {
  return PLAN_SEATS[plan];
}

/** True when adding one more staff member would exceed the plan's seats. */
export function seatsExhausted(plan: PlanKey, currentSeats: number) {
  const limit = seatLimit(plan);
  return limit !== null && currentSeats >= limit;
}

/**
 * Staff statuses that hold a seat: everyone still on the team, which is exactly
 * who the staff page lists. A pending invite holds its seat, or a salon could
 * invite past its limit and let the acceptances overflow it. A suspension keeps
 * its seat, so bringing someone back from leave is never refused. Only removal
 * frees one — a removed stylist's row is kept for the history, so counting rows
 * instead of this set left a full salon unable to hire a replacement.
 */
export const SEAT_HOLDING_STATUSES = ["INVITED", "ACTIVE", "SUSPENDED"] as const;

export function holdsSeat(status: string) {
  return (SEAT_HOLDING_STATUSES as readonly string[]).includes(status);
}

/** True when a status change puts someone back on the team, so it needs a free seat like an invite. */
export function statusChangeTakesSeat(from: string, to: string) {
  return !holdsSeat(from) && holdsSeat(to);
}

/** The next tier up that actually unlocks something new, or null at the top. */
export function nextPlanUp(plan: PlanKey): PlanKey | null {
  const locked = lockedModulesFor(plan);
  if (locked.length === 0) return null;

  const needed = Math.min(...locked.map((m) => PLAN_RANK[MODULE_MIN_PLAN[m]]));
  return PLAN_ORDER.find((p) => PLAN_RANK[p] === needed) ?? null;
}

/** The cheapest plan that includes this module. */
export function planRequiredFor(module: ModuleKey): PlanKey {
  return MODULE_MIN_PLAN[module];
}

/**
 * Marketing bullets for a plan, generated from the ladder above.
 *
 * Everything a cheaper tier already covered collapses into a single
 * "Everything in <plan>" line, so each tier reads as a strict addition.
 */
export function planFeatureList(plan: PlanKey, previousPlanName?: string | null): string[] {
  const rank = PLAN_RANK[plan];
  const included = FEATURE_GROUPS.filter((g) => groupRank(g) <= rank);

  const own = included.filter((g) => groupRank(g) === rank).map((g) => g.label);
  const inherited = included.filter((g) => groupRank(g) < rank);

  if (inherited.length === 0) return own;
  if (previousPlanName) return [`Everything in ${previousPlanName}`, ...own];
  return included.map((g) => g.label);
}
