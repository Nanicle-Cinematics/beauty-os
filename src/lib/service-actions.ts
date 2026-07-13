"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createService, toggleServiceActive } from "@/lib/service-data";
import { requireTenantAccess } from "@/lib/auth";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function safeBusinessSlug(value: string) {
  return value.replace(/[^a-z0-9-]/g, "");
}

function parseMoney(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function parseInt(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function createServiceAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  await requireTenantAccess(businessSlug);

  const deposit = parseMoney(getString(formData, "depositAmount"));

  await createService({
    businessSlug,
    name: getString(formData, "name"),
    description: getString(formData, "description"),
    price: parseMoney(getString(formData, "price")),
    depositAmount: Number.isFinite(deposit) ? deposit : null,
    durationMinutes: parseInt(getString(formData, "durationMinutes")),
    colorHex: getString(formData, "colorHex"),
    categoryId: getString(formData, "categoryId"),
    newCategoryName: getString(formData, "newCategoryName"),
    staffIds: formData.getAll("staffIds").map((value) => String(value)),
  });

  revalidatePath(`/${businessSlug}/services`);
  redirect(`/${businessSlug}/services`);
}

export async function toggleServiceActiveAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  await requireTenantAccess(businessSlug);

  await toggleServiceActive({
    businessSlug,
    serviceId: getString(formData, "serviceId"),
  });

  revalidatePath(`/${businessSlug}/services`);
  redirect(`/${businessSlug}/services`);
}
