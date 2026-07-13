"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { inviteStaff, setStaffStatus } from "@/lib/staff-data";
import { requireTenantAccess } from "@/lib/auth";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function safeBusinessSlug(value: string) {
  return value.replace(/[^a-z0-9-]/g, "");
}

export async function inviteStaffAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  await requireTenantAccess(businessSlug);

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
  redirect(`/${businessSlug}/staff`);
}

export async function setStaffStatusAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  await requireTenantAccess(businessSlug);

  await setStaffStatus({
    businessSlug,
    staffId: getString(formData, "staffId"),
    status: getString(formData, "status") as "ACTIVE" | "SUSPENDED" | "REMOVED",
  });

  revalidatePath(`/${businessSlug}/staff`);
  redirect(`/${businessSlug}/staff`);
}
