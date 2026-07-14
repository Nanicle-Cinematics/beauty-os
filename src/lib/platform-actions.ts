"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth";
import { setBusinessStatus, changeBusinessPlan } from "@/lib/platform-data";
import { resendOwnerInvite, revokeOwnerInvite } from "@/lib/onboarding-data";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

// Demo users carry a sentinel id ("demo_*") that is not a real User row, so it
// cannot satisfy the AuditLog.actorUserId foreign key — record those as system.
function actorId(id: string) {
  return id && !id.startsWith("demo_") ? id : null;
}

export async function setBusinessStatusAction(formData: FormData) {
  const admin = await requirePlatformAdmin();

  await setBusinessStatus({
    businessId: getString(formData, "businessId"),
    status: getString(formData, "status"),
    actorUserId: actorId(admin.id),
  });

  revalidatePath("/platform");
}

export async function changeBusinessPlanAction(formData: FormData) {
  const admin = await requirePlatformAdmin();

  await changeBusinessPlan({
    businessId: getString(formData, "businessId"),
    planId: getString(formData, "planId"),
    actorUserId: actorId(admin.id),
  });

  revalidatePath("/platform");
}

export async function resendInviteAction(formData: FormData) {
  await requirePlatformAdmin();

  const result = await resendOwnerInvite(getString(formData, "businessId"));
  if (!result.ok) {
    redirect(`/platform?inviteError=${encodeURIComponent(result.error)}`);
  }

  revalidatePath("/platform");
  redirect(`/platform?invite=${result.inviteToken}&slug=${result.slug}&resent=1`);
}

export async function revokeInviteAction(formData: FormData) {
  await requirePlatformAdmin();

  const result = await revokeOwnerInvite(getString(formData, "businessId"));

  revalidatePath("/platform");
  redirect(result.slug ? `/platform?revoked=${result.slug}` : "/platform");
}
