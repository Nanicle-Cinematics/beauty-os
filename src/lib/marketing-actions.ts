"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createCampaign,
  createCoupon,
  createTier,
  toggleCoupon,
  updateLoyaltyProgram,
} from "@/lib/marketing-data";
import { requireTenantAccess } from "@/lib/auth";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function safeBusinessSlug(value: string) {
  return value.replace(/[^a-z0-9-]/g, "");
}

function parseNumber(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function parseDate(value: string) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function createCampaignAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  await requireTenantAccess(businessSlug);

  await createCampaign({
    businessSlug,
    name: getString(formData, "name"),
    channel: getString(formData, "channel"),
    type: getString(formData, "type"),
    scheduledAt: parseDate(getString(formData, "scheduledAt")),
    content: getString(formData, "content"),
  });

  revalidatePath(`/${businessSlug}/marketing`);
  redirect(`/${businessSlug}/marketing`);
}

export async function createCouponAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  await requireTenantAccess(businessSlug);

  const maxUses = parseNumber(getString(formData, "maxUses"));

  await createCoupon({
    businessSlug,
    code: getString(formData, "code"),
    discountType: getString(formData, "discountType"),
    value: parseNumber(getString(formData, "value")),
    maxUses: Number.isFinite(maxUses) ? maxUses : null,
    expiresAt: parseDate(getString(formData, "expiresAt")),
  });

  revalidatePath(`/${businessSlug}/marketing`);
  redirect(`/${businessSlug}/marketing`);
}

export async function toggleCouponAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  await requireTenantAccess(businessSlug);

  await toggleCoupon({ businessSlug, couponId: getString(formData, "couponId") });

  revalidatePath(`/${businessSlug}/marketing`);
  redirect(`/${businessSlug}/marketing`);
}

export async function updateLoyaltyAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  await requireTenantAccess(businessSlug);

  await updateLoyaltyProgram({
    businessSlug,
    pointsPerCurrencyUnit: parseNumber(getString(formData, "pointsPerCurrencyUnit")),
    redemptionRate: parseNumber(getString(formData, "redemptionRate")),
    active: getString(formData, "active") === "on",
  });

  revalidatePath(`/${businessSlug}/marketing`);
  redirect(`/${businessSlug}/marketing`);
}

export async function createTierAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  await requireTenantAccess(businessSlug);

  const minSpend = parseNumber(getString(formData, "minSpend"));
  const discountPercent = parseNumber(getString(formData, "discountPercent"));

  await createTier({
    businessSlug,
    name: getString(formData, "name"),
    minSpend: Number.isFinite(minSpend) ? minSpend : null,
    discountPercent: Number.isFinite(discountPercent) ? discountPercent : null,
    perks: getString(formData, "perks"),
  });

  revalidatePath(`/${businessSlug}/marketing`);
  redirect(`/${businessSlug}/marketing`);
}
