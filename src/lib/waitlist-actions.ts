"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createWaitlistEntry,
  updateWaitlistEntry,
  setWaitlistStatus,
  deleteWaitlistEntry,
  promoteWaitlistEntry,
} from "@/lib/waitlist-data";
import { requireTenantAccess, type AppUser } from "@/lib/auth";
import { authorizeCapability, CAPABILITY_MODULE, type Capability } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function safeBusinessSlug(value: string) {
  return value.replace(/[^a-z0-9-]/g, "");
}

function parseDate(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function authorize(businessSlug: string, capability: Capability) {
  const user = await requireTenantAccess(businessSlug);
  const { membership, allowed, blockedByPlan } = await authorizeCapability(user, businessSlug, capability);
  // Blocked by the plan rather than the role: send them to the upgrade page.
  // Telling a manager they lack permission to do their own job would read as a
  // broken account, when the real answer is that the workspace never bought it.
  if (blockedByPlan) {
    redirect(`/${businessSlug}/upgrade?module=${CAPABILITY_MODULE[capability]}`);
  }
  return { user, membership, allowed, blockedByPlan };
}

/** Best-effort audit: losing the trail must never lose the change. */
async function audit(
  businessSlug: string,
  user: AppUser,
  staffMemberId: string | null,
  action: string,
  entityId: string,
  metadata: Record<string, unknown>,
) {
  try {
    const business = await prisma.business.findUnique({ where: { slug: businessSlug }, select: { id: true } });
    if (!business) return;
    await prisma.auditLog.create({
      data: { businessId: business.id, actorUserId: user.id, actorStaffId: staffMemberId, action, entityType: "waitlist_entry", entityId, metadata: metadata as never },
    });
  } catch {
    /* ignore */
  }
}

export async function createWaitlistEntryAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const { allowed } = await authorize(businessSlug, "appointments:edit");
  if (!allowed) {
    redirect(`/${businessSlug}/waitlist?toastError=${encodeURIComponent("You don't have permission to manage the waitlist.")}`);
  }

  const result = await createWaitlistEntry({
    businessSlug,
    customer: getString(formData, "customer"),
    service: getString(formData, "service"),
    preferredStaffId: getString(formData, "preferredStaffId"),
    earliestDate: parseDate(getString(formData, "earliestDate")),
    latestDate: parseDate(getString(formData, "latestDate")),
  });

  revalidatePath(`/${businessSlug}/waitlist`);
  redirect(
    result.ok
      ? `/${businessSlug}/waitlist?toast=${encodeURIComponent("Added to waitlist")}`
      : `/${businessSlug}/waitlist?toastError=${encodeURIComponent(result.error)}`,
  );
}

export async function updateWaitlistEntryAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const entryId = getString(formData, "entryId");
  const { user, membership, allowed } = await authorize(businessSlug, "appointments:edit");
  const back = `/${businessSlug}/waitlist/${entryId}`;
  if (!allowed) redirect(`${back}?error=${encodeURIComponent("You don't have permission to manage the waitlist.")}`);

  const result = await updateWaitlistEntry({
    businessSlug,
    entryId,
    customer: getString(formData, "customer"),
    service: getString(formData, "service"),
    preferredStaffId: getString(formData, "preferredStaffId"),
    earliestDate: parseDate(getString(formData, "earliestDate")),
    latestDate: parseDate(getString(formData, "latestDate")),
    status: getString(formData, "status"),
  });
  if (!result.ok) redirect(`${back}?error=${encodeURIComponent(result.error)}`);

  await audit(businessSlug, user, membership?.staffMemberId ?? null, "waitlist.updated", entryId, {});
  revalidatePath(`/${businessSlug}/waitlist`);
  redirect(`/${businessSlug}/waitlist?toast=${encodeURIComponent("Waitlist entry updated")}`);
}

export async function setWaitlistStatusAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const entryId = getString(formData, "entryId");
  const status = getString(formData, "status");
  const { user, membership, allowed } = await authorize(businessSlug, "appointments:edit");
  if (!allowed) {
    redirect(`/${businessSlug}/waitlist?toastError=${encodeURIComponent("You don't have permission to manage the waitlist.")}`);
  }

  const result = await setWaitlistStatus(businessSlug, entryId, status);
  if (!result.ok) {
    redirect(`/${businessSlug}/waitlist?toastError=${encodeURIComponent(result.error)}`);
  }

  await audit(businessSlug, user, membership?.staffMemberId ?? null, "waitlist.status_changed", entryId, { to: status });
  revalidatePath(`/${businessSlug}/waitlist`);
  redirect(`/${businessSlug}/waitlist?toast=${encodeURIComponent("Waitlist updated")}`);
}

export async function promoteWaitlistEntryAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const entryId = getString(formData, "entryId");
  const { user, membership, allowed } = await authorize(businessSlug, "appointments:edit");
  if (!allowed) {
    redirect(`/${businessSlug}/waitlist?toastError=${encodeURIComponent("You don't have permission to manage the waitlist.")}`);
  }

  const result = await promoteWaitlistEntry(businessSlug, entryId);
  if (!result.ok) {
    redirect(`/${businessSlug}/waitlist?toastError=${encodeURIComponent(result.error)}`);
  }

  await audit(businessSlug, user, membership?.staffMemberId ?? null, "waitlist.promoted", entryId, { appointmentId: result.appointmentId });
  revalidatePath(`/${businessSlug}/waitlist`);
  revalidatePath(`/${businessSlug}/appointments`);
  // Straight to the new hold so staff can set the real time.
  redirect(`/${businessSlug}/appointments/${result.appointmentId}?toast=${encodeURIComponent("Held from waitlist — set the time")}`);
}

export async function deleteWaitlistEntryAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const entryId = getString(formData, "entryId");
  const { user, membership, allowed } = await authorize(businessSlug, "appointments:edit");
  if (!allowed) {
    redirect(`/${businessSlug}/waitlist?toastError=${encodeURIComponent("You don't have permission to manage the waitlist.")}`);
  }

  const result = await deleteWaitlistEntry(businessSlug, entryId);
  if (!result.ok) {
    redirect(`/${businessSlug}/waitlist?toastError=${encodeURIComponent(result.error)}`);
  }

  await audit(businessSlug, user, membership?.staffMemberId ?? null, "waitlist.deleted", entryId, {});
  revalidatePath(`/${businessSlug}/waitlist`);
  redirect(`/${businessSlug}/waitlist?toast=${encodeURIComponent("Removed from waitlist")}`);
}
