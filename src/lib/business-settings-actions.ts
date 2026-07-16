"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/auth";
import { updateBusinessDetails, updateBusinessHours, WEEKDAYS, type DayHours } from "@/lib/business-settings-data";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

// requireTenantAccess has already scoped RLS to this tenant, so the membership
// lookup is limited to the current business.
async function isManager(userId: string) {
  const membership = await prisma.staffMember.findFirst({
    where: { userId, status: "ACTIVE", role: { in: ["OWNER", "MANAGER"] } },
    select: { id: true },
  });
  return Boolean(membership);
}

export async function updateBusinessDetailsAction(formData: FormData) {
  const slug = getString(formData, "slug");
  const user = await requireTenantAccess(slug);
  if (!(await isManager(user.id))) {
    redirect(`/${slug}/settings?error=${encodeURIComponent("Only owners and managers can change business settings.")}`);
  }

  const result = await updateBusinessDetails({
    slug,
    name: getString(formData, "name"),
    description: getString(formData, "description"),
    email: getString(formData, "email"),
    phone: getString(formData, "phone"),
    logoUrl: getString(formData, "logoUrl"),
    addressLine1: getString(formData, "addressLine1"),
    addressLine2: getString(formData, "addressLine2"),
    city: getString(formData, "city"),
    region: getString(formData, "region"),
    country: getString(formData, "country"),
    timezone: getString(formData, "timezone"),
    currency: getString(formData, "currency"),
    taxRate: getString(formData, "taxRate"),
    taxId: getString(formData, "taxId"),
  });

  redirect(result.ok ? `/${slug}/settings?updated=details` : `/${slug}/settings?error=${encodeURIComponent(result.error)}`);
}

export async function updateBusinessHoursAction(formData: FormData) {
  const slug = getString(formData, "slug");
  const user = await requireTenantAccess(slug);
  if (!(await isManager(user.id))) {
    redirect(`/${slug}/settings?error=${encodeURIComponent("Only owners and managers can change business settings.")}`);
  }

  const days: DayHours[] = WEEKDAYS.map((_label, day) => ({
    dayOfWeek: day,
    isClosed: formData.get(`day_${day}_closed`) === "on",
    openTime: getString(formData, `day_${day}_open`),
    closeTime: getString(formData, `day_${day}_close`),
  }));

  const result = await updateBusinessHours(slug, days);
  redirect(result.ok ? `/${slug}/settings?updated=hours` : `/${slug}/settings?error=${encodeURIComponent(result.error)}`);
}
