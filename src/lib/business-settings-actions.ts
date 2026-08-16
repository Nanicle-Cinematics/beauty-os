"use server";

import { redirect } from "next/navigation";
import { requireTenantAccess } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { updateBusinessDetails, updateBusinessHours, WEEKDAYS, type DayHours } from "@/lib/business-settings-data";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

async function logoFromForm(formData: FormData) {
  const remove = getString(formData, "removeLogo") === "true";
  if (remove) return null;

  const file = formData.get("logoFile");
  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) {
      return { error: "Workspace picture upload must be an image file." };
    }
    if (file.size > 750_000) {
      return { error: "Workspace picture must be 750KB or smaller." };
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    return `data:${file.type};base64,${bytes.toString("base64")}`;
  }

  const url = getString(formData, "logoUrl").trim();
  if (url) return url;
  return getString(formData, "currentLogoUrl");
}

// requireTenantAccess has already scoped RLS to this tenant, so the membership
// lookup is limited to the current business.
// Was: a StaffMember lookup with NO businessId filter, i.e. "is this user a
// manager ANYWHERE". It only behaved because RLS happened to scope the query;
// with DB_RLS off (docs/RLS.md documents that as the instant rollback) an owner
// of one studio could edit the settings of another where they are merely staff.
// Authorization now scopes by slug explicitly — see src/lib/permissions.ts.

export async function updateBusinessDetailsAction(formData: FormData) {
  const slug = getString(formData, "slug");
  const user = await requireTenantAccess(slug);
  if (!(await can(user, slug, "business:settings"))) {
    redirect(`/${slug}/settings?error=${encodeURIComponent("Only owners and managers can change business settings.")}`);
  }

  const logoUrl = await logoFromForm(formData);
  if (typeof logoUrl === "object" && logoUrl && "error" in logoUrl) {
    redirect(`/${slug}/settings?error=${encodeURIComponent(logoUrl.error)}`);
  }

  const result = await updateBusinessDetails({
    slug,
    name: getString(formData, "name"),
    description: getString(formData, "description"),
    email: getString(formData, "email"),
    phone: getString(formData, "phone"),
    logoUrl,
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
  if (!(await can(user, slug, "business:settings"))) {
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
