import "server-only";

import { prisma } from "@/lib/prisma";
import type { AppUser } from "@/lib/auth";

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

/** Convenience for actions: resolve membership and check one capability. */
export async function can(user: AppUser, businessSlug: string, capability: Capability) {
  const membership = await membershipIn(user, businessSlug);
  return roleCan(membership?.role, capability);
}
