"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin, startSession } from "@/lib/auth";
import { createBusiness, acceptInvite } from "@/lib/onboarding-data";
import { sendInviteEmail } from "@/lib/email";
import { getBaseUrl, inviteUrl } from "@/lib/urls";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

export async function createBusinessAction(formData: FormData) {
  const admin = await requirePlatformAdmin();

  const result = await createBusiness({
    name: getString(formData, "name"),
    slug: getString(formData, "slug"),
    categoryId: getString(formData, "categoryId"),
    currency: getString(formData, "currency"),
    timezone: getString(formData, "timezone"),
    email: getString(formData, "email"),
    phone: getString(formData, "phone"),
    ownerName: getString(formData, "ownerName"),
    ownerEmail: getString(formData, "ownerEmail"),
    planId: getString(formData, "planId"),
    // Demo sentinel ids are not real User rows — record as system actor.
    actorUserId: admin.id.startsWith("demo_") ? null : admin.id,
  });

  if (!result.ok) {
    redirect(`/platform/onboard?error=${encodeURIComponent(result.error)}`);
  }

  const url = inviteUrl(await getBaseUrl(), result.inviteToken);
  const mail = await sendInviteEmail({
    to: result.ownerEmail,
    name: result.ownerName,
    businessName: result.businessName,
    url,
    businessId: result.businessId,
  });
  const emailed = mail.ok && !mail.dryRun ? "&emailed=1" : "";

  revalidatePath("/platform");
  redirect(`/platform?created=${result.slug}&invite=${result.inviteToken}${emailed}`);
}

export async function acceptInviteAction(formData: FormData) {
  const token = getString(formData, "token");

  const result = await acceptInvite({
    token,
    name: getString(formData, "name"),
    password: getString(formData, "password"),
  });

  if (!result.ok) {
    redirect(`/invite/${encodeURIComponent(token)}?error=${encodeURIComponent(result.error)}`);
  }

  // Log the new owner straight in and drop them into their workspace.
  await startSession(result.userId);
  redirect(`/${result.slug}`);
}
