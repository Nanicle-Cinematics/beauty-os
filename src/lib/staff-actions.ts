"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  inviteStaff,
  setStaffStatus,
  updateStaffProfile,
  setStaffRole,
  getStaffDetail,
  type StaffDayHours,
} from "@/lib/staff-data";
import { requireTenantAccess, type AppUser } from "@/lib/auth";
import { membershipIn, roleCan, type Capability } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function safeBusinessSlug(value: string) {
  return value.replace(/[^a-z0-9-]/g, "");
}

const DAYS = [0, 1, 2, 3, 4, 5, 6];

/** Reads day-N-start / day-N-end / day-N-off out of the posted form. */
function parseHours(formData: FormData): StaffDayHours[] {
  return DAYS.map((d) => ({
    dayOfWeek: d,
    startTime: getString(formData, `day-${d}-start`) || "09:00",
    endTime: getString(formData, `day-${d}-end`) || "17:00",
    isOff: formData.get(`day-${d}-off`) === "on",
  }));
}

async function authorize(businessSlug: string, capability: Capability) {
  const user = await requireTenantAccess(businessSlug);
  const membership = await membershipIn(user, businessSlug);
  return { user, membership, allowed: roleCan(membership?.role, capability) };
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
      data: {
        businessId: business.id,
        actorUserId: user.id,
        actorStaffId: staffMemberId,
        action,
        entityType: "staff_member",
        entityId,
        metadata: metadata as never,
      },
    });
  } catch {
    /* ignore */
  }
}

export async function inviteStaffAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const { allowed } = await authorize(businessSlug, "staff:edit");
  if (!allowed) {
    redirect(`/${businessSlug}/staff?toastError=${encodeURIComponent("Only owners and managers can invite staff.")}`);
  }

  const commissionRaw = Number.parseFloat(getString(formData, "commissionValue"));

  await inviteStaff({
    businessSlug,
    email: getString(formData, "email"),
    role: getString(formData, "role"),
    commissionType: getString(formData, "commissionType"),
    commissionValue: Number.isFinite(commissionRaw) ? commissionRaw : null,
    colorHex: getString(formData, "colorHex"),
    bio: getString(formData, "bio"),
  });

  revalidatePath(`/${businessSlug}/staff`);
  redirect(`/${businessSlug}/staff?toast=${encodeURIComponent("Invitation sent")}`);
}

export async function updateStaffProfileAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const staffId = getString(formData, "staffId");
  const { user, membership, allowed } = await authorize(businessSlug, "staff:edit");

  const back = `/${businessSlug}/staff/${staffId}`;
  if (!allowed) {
    redirect(`${back}?error=${encodeURIComponent("Only owners and managers can edit staff.")}`);
  }

  const commissionRaw = Number.parseFloat(getString(formData, "commissionValue"));
  const commissionType = getString(formData, "commissionType");

  const result = await updateStaffProfile({
    businessSlug,
    staffId,
    bio: getString(formData, "bio"),
    colorHex: getString(formData, "colorHex"),
    commissionType,
    commissionValue: Number.isFinite(commissionRaw) ? commissionRaw : null,
    serviceIds: formData.getAll("serviceIds").map((v) => String(v)),
    hours: parseHours(formData),
  });

  if (!result.ok) {
    redirect(`${back}?error=${encodeURIComponent(result.error)}`);
  }

  await audit(businessSlug, user, membership?.staffMemberId ?? null, "staff.profile_updated", staffId, {});

  revalidatePath(`/${businessSlug}/staff`);
  revalidatePath(back);
  redirect(`/${businessSlug}/staff?toast=${encodeURIComponent("Staff profile updated")}`);
}

export async function setStaffRoleAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const staffId = getString(formData, "staffId");
  const role = getString(formData, "role");
  // Note the stricter capability: only an OWNER may grant roles.
  const { user, membership, allowed } = await authorize(businessSlug, "staff:role");

  const back = `/${businessSlug}/staff/${staffId}`;
  if (!allowed) {
    redirect(`${back}?error=${encodeURIComponent("Only an owner can change roles.")}`);
  }

  const before = await getStaffDetail(businessSlug, staffId, user.id);

  const result = await setStaffRole({ businessSlug, staffId, role, actingUserId: user.id });
  if (!result.ok) {
    redirect(`${back}?error=${encodeURIComponent(result.error)}`);
  }

  if (before && before.role !== role) {
    await audit(businessSlug, user, membership?.staffMemberId ?? null, "staff.role_changed", staffId, {
      from: before.role,
      to: role,
    });
  }

  revalidatePath(`/${businessSlug}/staff`);
  revalidatePath(back);
  redirect(`/${businessSlug}/staff?toast=${encodeURIComponent("Role updated")}`);
}

export async function setStaffStatusAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const staffId = getString(formData, "staffId");
  const status = getString(formData, "status") as "ACTIVE" | "SUSPENDED" | "REMOVED";
  const { user, membership, allowed } = await authorize(businessSlug, "staff:status");
  if (!allowed) {
    redirect(`/${businessSlug}/staff?toastError=${encodeURIComponent("Only owners and managers can change staff status.")}`);
  }

  await setStaffStatus({ businessSlug, staffId, status });

  await audit(businessSlug, user, membership?.staffMemberId ?? null, "staff.status_changed", staffId, { to: status });

  revalidatePath(`/${businessSlug}/staff`);
  redirect(`/${businessSlug}/staff?toast=${encodeURIComponent("Staff status updated")}`);
}
