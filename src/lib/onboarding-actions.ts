"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth";
import { createBusiness } from "@/lib/onboarding-data";

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
    ownerPassword: getString(formData, "ownerPassword"),
    planId: getString(formData, "planId"),
    // Demo sentinel ids are not real User rows — record as system actor.
    actorUserId: admin.id.startsWith("demo_") ? null : admin.id,
  });

  if (!result.ok) {
    redirect(`/platform/onboard?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath("/platform");
  redirect(`/platform?created=${result.slug}`);
}
