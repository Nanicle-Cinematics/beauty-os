"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createCampaign,
  createCoupon,
  createTier,
  toggleCoupon,
  updateLoyaltyProgram,
  updateCampaign,
  deleteCampaign,
  updateCoupon,
  deleteCoupon,
  updateTier,
  deleteTier,
} from "@/lib/marketing-data";
import { requireTenantAccess, type AppUser } from "@/lib/auth";
import { membershipIn, roleCan, type Capability } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function safeBusinessSlug(value: string) {
  return value.replace(/[^a-z0-9-]/g, "");
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
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown>,
) {
  try {
    const business = await prisma.business.findUnique({ where: { slug: businessSlug }, select: { id: true } });
    if (!business) return;
    await prisma.auditLog.create({
      data: { businessId: business.id, actorUserId: user.id, actorStaffId: staffMemberId, action, entityType, entityId, metadata: metadata as never },
    });
  } catch {
    /* ignore */
  }
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

// ── Editing (item 14) ───────────────────────────────────────────────────────

export async function updateCampaignAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const campaignId = getString(formData, "campaignId");
  const { user, membership, allowed } = await authorize(businessSlug, "marketing:edit");
  const back = `/${businessSlug}/marketing/campaigns/${campaignId}`;
  if (!allowed) redirect(`${back}?error=${encodeURIComponent("Only owners and managers can edit campaigns.")}`);

  const result = await updateCampaign({
    businessSlug,
    campaignId,
    name: getString(formData, "name"),
    channel: getString(formData, "channel"),
    type: getString(formData, "type"),
    status: getString(formData, "status"),
    scheduledAt: parseDate(getString(formData, "scheduledAt")),
    content: getString(formData, "content"),
  });
  if (!result.ok) redirect(`${back}?error=${encodeURIComponent(result.error)}`);

  await audit(businessSlug, user, membership?.staffMemberId ?? null, "campaign.updated", "campaign", campaignId, {});
  revalidatePath(`/${businessSlug}/marketing`);
  redirect(`/${businessSlug}/marketing?toast=${encodeURIComponent("Campaign updated")}`);
}

export async function deleteCampaignAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const campaignId = getString(formData, "campaignId");
  const { user, membership, allowed } = await authorize(businessSlug, "marketing:delete");
  const back = `/${businessSlug}/marketing/campaigns/${campaignId}`;
  if (!allowed) redirect(`${back}?error=${encodeURIComponent("Only owners and managers can delete campaigns.")}`);

  const result = await deleteCampaign(businessSlug, campaignId);
  if (!result.ok) redirect(`${back}?error=${encodeURIComponent(result.error)}`);

  await audit(businessSlug, user, membership?.staffMemberId ?? null, "campaign.deleted", "campaign", campaignId, {});
  revalidatePath(`/${businessSlug}/marketing`);
  redirect(`/${businessSlug}/marketing?toast=${encodeURIComponent("Campaign deleted")}`);
}

export async function updateCouponAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const couponId = getString(formData, "couponId");
  const { user, membership, allowed } = await authorize(businessSlug, "marketing:edit");
  const back = `/${businessSlug}/marketing/coupons/${couponId}`;
  if (!allowed) redirect(`${back}?error=${encodeURIComponent("Only owners and managers can edit coupons.")}`);

  const maxUses = parseNumber(getString(formData, "maxUses"));
  const result = await updateCoupon({
    businessSlug,
    couponId,
    code: getString(formData, "code"),
    discountType: getString(formData, "discountType"),
    value: parseNumber(getString(formData, "value")),
    maxUses: Number.isFinite(maxUses) ? maxUses : null,
    expiresAt: parseDate(getString(formData, "expiresAt")),
    active: getString(formData, "active") === "on",
  });
  if (!result.ok) redirect(`${back}?error=${encodeURIComponent(result.error)}`);

  await audit(businessSlug, user, membership?.staffMemberId ?? null, "coupon.updated", "coupon", couponId, {});
  revalidatePath(`/${businessSlug}/marketing`);
  redirect(`/${businessSlug}/marketing?toast=${encodeURIComponent("Coupon updated")}`);
}

export async function deleteCouponAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const couponId = getString(formData, "couponId");
  const { user, membership, allowed } = await authorize(businessSlug, "marketing:delete");
  const back = `/${businessSlug}/marketing/coupons/${couponId}`;
  if (!allowed) redirect(`${back}?error=${encodeURIComponent("Only owners and managers can delete coupons.")}`);

  const result = await deleteCoupon(businessSlug, couponId);
  if (!result.ok) redirect(`${back}?error=${encodeURIComponent(result.error)}`);

  await audit(businessSlug, user, membership?.staffMemberId ?? null, "coupon.deleted", "coupon", couponId, {});
  revalidatePath(`/${businessSlug}/marketing`);
  redirect(`/${businessSlug}/marketing?toast=${encodeURIComponent("Coupon deleted")}`);
}

export async function updateTierAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const tierId = getString(formData, "tierId");
  const { user, membership, allowed } = await authorize(businessSlug, "marketing:edit");
  const back = `/${businessSlug}/marketing/tiers/${tierId}`;
  if (!allowed) redirect(`${back}?error=${encodeURIComponent("Only owners and managers can edit tiers.")}`);

  const minPoints = parseNumber(getString(formData, "minPoints"));
  const minSpend = parseNumber(getString(formData, "minSpend"));
  const discountPercent = parseNumber(getString(formData, "discountPercent"));
  const result = await updateTier({
    businessSlug,
    tierId,
    name: getString(formData, "name"),
    minPoints: Number.isFinite(minPoints) ? minPoints : null,
    minSpend: Number.isFinite(minSpend) ? minSpend : null,
    discountPercent: Number.isFinite(discountPercent) ? discountPercent : null,
    perks: getString(formData, "perks"),
  });
  if (!result.ok) redirect(`${back}?error=${encodeURIComponent(result.error)}`);

  await audit(businessSlug, user, membership?.staffMemberId ?? null, "tier.updated", "client_tier", tierId, {});
  revalidatePath(`/${businessSlug}/marketing`);
  redirect(`/${businessSlug}/marketing?toast=${encodeURIComponent("Tier updated")}`);
}

export async function deleteTierAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const tierId = getString(formData, "tierId");
  const { user, membership, allowed } = await authorize(businessSlug, "marketing:delete");
  const back = `/${businessSlug}/marketing/tiers/${tierId}`;
  if (!allowed) redirect(`${back}?error=${encodeURIComponent("Only owners and managers can delete tiers.")}`);

  const result = await deleteTier(businessSlug, tierId);
  if (!result.ok) redirect(`${back}?error=${encodeURIComponent(result.error)}`);

  await audit(businessSlug, user, membership?.staffMemberId ?? null, "tier.deleted", "client_tier", tierId, {});
  revalidatePath(`/${businessSlug}/marketing`);
  redirect(`/${businessSlug}/marketing?toast=${encodeURIComponent("Tier deleted")}`);
}
