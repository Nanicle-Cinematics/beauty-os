import "server-only";

import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import type { AppUser } from "@/lib/auth";
import { workspaceHasModule } from "@/lib/entitlement-data";
import type { ModuleKey } from "@/lib/entitlements";

export type BusinessRole =
  | "OWNER"
  | "MANAGER"
  | "RECEPTIONIST"
  | "SENIOR_ARTIST"
  | "ARTIST"
  | "CASHIER"
  | "INVENTORY_OFFICER";

/**
 * Who may do what, per business role.
 *
 * Front desk (RECEPTIONIST) can correct client details — that is the job. Only
 * OWNER/MANAGER may archive or delete a record, because those decisions remove
 * information other people rely on.
 */
export const CAPABILITIES = {
  "clients:edit": ["OWNER", "MANAGER", "RECEPTIONIST"],
  "clients:archive": ["OWNER", "MANAGER"],
  "clients:delete": ["OWNER", "MANAGER"],
  // Services are the menu and the price list — a commercial decision, not front
  // desk work. A receptionist may correct a client's phone number but must not
  // reprice a service.
  "services:edit": ["OWNER", "MANAGER"],
  "services:retire": ["OWNER", "MANAGER"],
  "services:delete": ["OWNER", "MANAGER"],
  // Staff profile, commission and hours: a manager runs the rota.
  "staff:edit": ["OWNER", "MANAGER"],
  "staff:status": ["OWNER", "MANAGER"],
  // Roles decide who may do everything else, so only an owner grants them.
  // A manager who could edit roles would simply make themselves an owner.
  "staff:role": ["OWNER"],
  // Inventory is what the INVENTORY_OFFICER role exists for. Editing product
  // details and adjusting tracked stock are their daily job; deleting a product
  // outright removes a record others may report on, so that stays with managers.
  "inventory:edit": ["OWNER", "MANAGER", "INVENTORY_OFFICER"],
  "inventory:adjust": ["OWNER", "MANAGER", "INVENTORY_OFFICER"],
  "inventory:delete": ["OWNER", "MANAGER"],
  // Managing the book — rescheduling, reassigning, confirming, cancelling — is
  // exactly front-desk work, so receptionists are included. Deleting the record
  // outright (only ever allowed with no payments) stays with managers.
  "appointments:edit": ["OWNER", "MANAGER", "RECEPTIONIST"],
  "appointments:delete": ["OWNER", "MANAGER"],
  // Campaigns cost money to send and coupons affect margin — a commercial
  // decision, so marketing is owner/manager, not front desk.
  "marketing:edit": ["OWNER", "MANAGER"],
  "marketing:delete": ["OWNER", "MANAGER"],
  // Taking a payment and tidying its reference/link is front-desk and cashier
  // work. Reversing money — refund or void — moves real funds and is a
  // manager/owner decision. There is deliberately no "edit the amount": a
  // completed transaction is never rewritten, only offset (refund) or voided.
  "payments:record": ["OWNER", "MANAGER", "RECEPTIONIST", "CASHIER"],
  "payments:edit": ["OWNER", "MANAGER", "CASHIER"],
  "payments:refund": ["OWNER", "MANAGER"],
  "payments:void": ["OWNER", "MANAGER"],
  "invoices:edit": ["OWNER", "MANAGER", "RECEPTIONIST", "CASHIER"],
  "invoices:send": ["OWNER", "MANAGER", "RECEPTIONIST", "CASHIER"],
  "invoices:void": ["OWNER", "MANAGER"],
  // Galleries protect deliverables and control when clients receive originals.
  // Reception can send links, but unlock/revoke/complete stay owner/manager.
  "galleries:edit": ["OWNER", "MANAGER", "RECEPTIONIST"],
  "galleries:unlock": ["OWNER", "MANAGER"],
  "galleries:complete": ["OWNER", "MANAGER"],
  "galleries:delete": ["OWNER", "MANAGER"],
  "business:settings": ["OWNER", "MANAGER"],
} as const satisfies Record<string, readonly BusinessRole[]>;

export type Capability = keyof typeof CAPABILITIES;

export type Membership = { staffMemberId: string | null; role: BusinessRole };

/**
 * The caller's membership IN THIS BUSINESS, scoped explicitly by slug.
 *
 * Never rely on RLS to scope an authorization check. RLS is defence-in-depth for
 * tenant isolation; `docs/RLS.md` documents unsetting DB_RLS as the instant
 * rollback, and an unscoped role query would silently start answering "is this
 * user a manager ANYWHERE" — letting someone who owns Studio A act as a manager
 * of Studio B, where they are only a receptionist.
 */
export async function membershipIn(user: AppUser, businessSlug: string): Promise<Membership | null> {
  // Platform admins are the vendor, not the salon. They already have
  // unrestricted reach through /platform, so denying them here would only push
  // support work into raw SQL. They have no StaffMember row, hence the null id.
  if (user.isPlatformAdmin) {
    return { staffMemberId: null, role: "OWNER" };
  }

  if (!isDatabaseConfigured()) {
    const demoMemberships: Record<string, readonly string[]> = {
      "owner@osuglow.example": ["osu-glow-studio"],
      "owner@luxelash.example": ["luxe-lash-lab"],
    };

    return demoMemberships[user.email]?.includes(businessSlug)
      ? { staffMemberId: null, role: "OWNER" }
      : null;
  }

  const membership = await prisma.staffMember.findFirst({
    where: { userId: user.id, status: "ACTIVE", business: { slug: businessSlug } },
    select: { id: true, role: true },
  });

  return membership ? { staffMemberId: membership.id, role: membership.role } : null;
}

export function roleCan(role: BusinessRole | null | undefined, capability: Capability) {
  if (!role) return false;
  return (CAPABILITIES[capability] as readonly string[]).includes(role);
}

/**
 * Which module each capability belongs to.
 *
 * Every guarded action already checks a capability, so mapping capabilities to
 * modules here means plan gating reaches every write in the app through one
 * edit. Hiding a locked module from the nav proves nothing — a Growth Suite
 * tenant could still POST straight at `recordPaymentAction`; this is the gate
 * that actually stops them.
 */
export const CAPABILITY_MODULE: Record<Capability, ModuleKey> = {
  "clients:edit": "clients",
  "clients:archive": "clients",
  "clients:delete": "clients",
  "services:edit": "services",
  "services:retire": "services",
  "services:delete": "services",
  "staff:edit": "staff",
  "staff:status": "staff",
  "staff:role": "staff",
  "inventory:edit": "inventory",
  "inventory:adjust": "inventory",
  "inventory:delete": "inventory",
  "appointments:edit": "appointments",
  "appointments:delete": "appointments",
  "marketing:edit": "marketing",
  "marketing:delete": "marketing",
  "payments:record": "payments",
  "payments:edit": "payments",
  "payments:refund": "payments",
  "payments:void": "payments",
  "invoices:edit": "invoices",
  "invoices:send": "invoices",
  "invoices:void": "invoices",
  "galleries:edit": "galleries",
  "galleries:unlock": "galleries",
  "galleries:complete": "galleries",
  "galleries:delete": "galleries",
  "business:settings": "settings",
};

export type Authorization = {
  membership: Membership | null;
  /** Role permits it AND the plan includes the module. */
  allowed: boolean;
  /** The role was sufficient; only the plan stood in the way. */
  blockedByPlan: boolean;
};

/**
 * The one check every guarded action runs: role first, then plan.
 *
 * `blockedByPlan` is kept separate so an action can tell someone their plan is
 * the problem — a manager who is told "you do not have permission" to take a
 * payment would reasonably think their account was broken.
 */
export async function authorizeCapability(
  user: AppUser,
  businessSlug: string,
  capability: Capability,
): Promise<Authorization> {
  const membership = await membershipIn(user, businessSlug);
  const roleAllows = roleCan(membership?.role, capability);

  if (!roleAllows) {
    return { membership, allowed: false, blockedByPlan: false };
  }

  // Platform admins are the vendor doing support, not a tenant spending money.
  const planAllows = user.isPlatformAdmin
    ? true
    : await workspaceHasModule(businessSlug, CAPABILITY_MODULE[capability]);

  return { membership, allowed: planAllows, blockedByPlan: !planAllows };
}

/** Convenience for actions: resolve membership and check one capability. */
export async function can(user: AppUser, businessSlug: string, capability: Capability) {
  const { allowed } = await authorizeCapability(user, businessSlug, capability);
  return allowed;
}
