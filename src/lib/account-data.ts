import "server-only";

import { prisma, tenantTransaction, isDatabaseConfigured } from "@/lib/prisma";
import { deleteBusiness } from "@/lib/platform-data";

export type OwnedWorkspace = { id: string; name: string; slug: string };

export async function getOwnedWorkspaces(userId: string): Promise<OwnedWorkspace[]> {
  if (!isDatabaseConfigured()) return [];
  const memberships = await prisma.staffMember.findMany({
    where: { userId, status: "ACTIVE", role: "OWNER" },
    select: { business: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((m) => m.business);
}

// Self-service workspace deletion. Server-side authorization: the caller must be
// an ACTIVE OWNER of the business (the client confirmation is only UX). Reuses
// deleteBusiness, which cascades all tenant data and cleans up orphaned members.
export async function deleteOwnedWorkspace(userId: string, businessId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Not available." };
  const owns = await prisma.staffMember.findFirst({
    where: { userId, businessId, status: "ACTIVE", role: "OWNER" },
    select: { id: true },
  });
  if (!owns) return { ok: false, error: "You don't have permission to delete this workspace." };

  const result = await deleteBusiness(businessId);
  return result.ok ? { ok: true } : { ok: false, error: "Could not delete the workspace." };
}

// Self-service account deletion (GDPR erasure). Blocked while the user still
// owns a workspace — those must be deleted first so their data isn't orphaned.
export async function deleteAccount(userId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Not available." };

  const owned = await prisma.staffMember.count({ where: { userId, status: "ACTIVE", role: "OWNER" } });
  if (owned > 0) {
    return { ok: false, error: "Delete the workspaces you own before deleting your account." };
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isPlatformAdmin: true } });
  if (!user) return { ok: false, error: "Account not found." };
  if (user.isPlatformAdmin) return { ok: false, error: "Platform admin accounts can't be self-deleted." };

  // Remove the person's memberships, then the user (cascades sessions, MFA
  // codes, verification tokens; AuditLog actor is SetNull automatically).
  await tenantTransaction(async (tx) => {
    await tx.staffMember.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
  });
  return { ok: true };
}
