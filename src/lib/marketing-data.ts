import "server-only";

import { prisma, isDatabaseConfigured } from "@/lib/prisma";

export type CampaignRow = {
  id: string;
  name: string;
  channel: string;
  type: string;
  status: string;
  statusKey: string;
  when: string;
};

export type CouponRow = {
  id: string;
  code: string;
  discount: string;
  uses: string;
  expiry: string;
  active: boolean;
};

export type TierRow = {
  id: string;
  name: string;
  threshold: string;
  discount: string;
  perks: string;
};

export type MarketingStat = { label: string; value: string; detail: string };

export type LoyaltyConfig = {
  pointsPerCurrencyUnit: number;
  redemptionRate: number;
  active: boolean;
  pointsIssued: number;
  members: number;
};

export type MarketingModuleData = {
  tenant: { id: string; name: string; slug: string; currency: string };
  stats: MarketingStat[];
  campaigns: CampaignRow[];
  coupons: CouponRow[];
  tiers: TierRow[];
  loyalty: LoyaltyConfig;
  channels: { value: string; label: string }[];
  types: { value: string; label: string }[];
};

export const CAMPAIGN_CHANNELS = [
  { value: "EMAIL", label: "Email" },
  { value: "SMS", label: "SMS" },
  { value: "WHATSAPP", label: "WhatsApp" },
];

export const CAMPAIGN_TYPES = [
  { value: "PROMO", label: "Promotion" },
  { value: "BIRTHDAY", label: "Birthday" },
  { value: "HOLIDAY", label: "Holiday" },
  { value: "WINBACK", label: "Win-back" },
  { value: "REFERRAL", label: "Referral" },
];

const CHANNEL_LABELS = Object.fromEntries(CAMPAIGN_CHANNELS.map((c) => [c.value, c.label]));
const TYPE_LABELS = Object.fromEntries(CAMPAIGN_TYPES.map((t) => [t.value, t.label]));
const VALID_CHANNELS = new Set(CAMPAIGN_CHANNELS.map((c) => c.value));
const VALID_TYPES = new Set(CAMPAIGN_TYPES.map((t) => t.value));

function currencySymbol(currency: string) {
  return currency === "GHS" ? "GH₵" : currency;
}

function money(amount: number, currency: string) {
  return `${currencySymbol(currency)} ${Math.round(amount).toLocaleString("en-US")}`;
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function shortDate(date: Date | null) {
  if (!date) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }).format(date);
}

function discountLabel(type: string, value: number, currency: string) {
  return type === "PERCENT" ? `${value}%` : money(value, currency);
}

function emptyLoyalty(): LoyaltyConfig {
  return { pointsPerCurrencyUnit: 1, redemptionRate: 1, active: true, pointsIssued: 0, members: 0 };
}

const fallbackMarketingData: Record<string, MarketingModuleData> = {
  "osu-glow-studio": {
    tenant: { id: "sample_osu_glow", name: "Osu Glow Studio", slug: "osu-glow-studio", currency: "GHS" },
    stats: [
      { label: "Campaigns", value: "0", detail: "0 scheduled" },
      { label: "Active coupons", value: "0", detail: "0 total" },
      { label: "Points issued", value: "0", detail: "0 members" },
      { label: "Membership tiers", value: "0", detail: "None yet" },
    ],
    campaigns: [],
    coupons: [],
    tiers: [],
    loyalty: emptyLoyalty(),
    channels: CAMPAIGN_CHANNELS,
    types: CAMPAIGN_TYPES,
  },
  "luxe-lash-lab": {
    tenant: { id: "sample_luxe_lash", name: "Luxe Lash Lab", slug: "luxe-lash-lab", currency: "GHS" },
    stats: [
      { label: "Campaigns", value: "0", detail: "0 scheduled" },
      { label: "Active coupons", value: "0", detail: "0 total" },
      { label: "Points issued", value: "0", detail: "0 members" },
      { label: "Membership tiers", value: "0", detail: "None yet" },
    ],
    campaigns: [],
    coupons: [],
    tiers: [],
    loyalty: emptyLoyalty(),
    channels: CAMPAIGN_CHANNELS,
    types: CAMPAIGN_TYPES,
  },
};

export async function getMarketingModuleData(businessSlug: string): Promise<MarketingModuleData | null> {
  if (!isDatabaseConfigured()) {
    return fallbackMarketingData[businessSlug] ?? null;
  }

  const business = await prisma.business.findUnique({
    where: { slug: businessSlug },
    select: { id: true, name: true, slug: true, currency: true },
  });

  if (!business) {
    return null;
  }

  const currency = business.currency;

  const [campaigns, coupons, tiers, program, ledger] = await Promise.all([
    prisma.campaign.findMany({ where: { businessId: business.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.coupon.findMany({ where: { businessId: business.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.clientTier.findMany({ where: { businessId: business.id }, orderBy: [{ minSpend: "asc" }, { minPoints: "asc" }] }),
    prisma.loyaltyProgram.findUnique({ where: { businessId: business.id } }),
    prisma.loyaltyLedgerEntry.findMany({ where: { businessId: business.id }, select: { points: true, type: true, customerId: true } }),
  ]);

  const pointsIssued = ledger
    .filter((entry) => entry.type === "EARNED")
    .reduce((sum, entry) => sum + entry.points, 0);
  const members = new Set(ledger.map((entry) => entry.customerId)).size;
  const activeCoupons = coupons.filter((coupon) => coupon.active).length;
  const scheduledCampaigns = campaigns.filter((campaign) => campaign.status === "SCHEDULED").length;

  const stats: MarketingStat[] = [
    { label: "Campaigns", value: String(campaigns.length), detail: `${scheduledCampaigns} scheduled` },
    { label: "Active coupons", value: String(activeCoupons), detail: `${coupons.length} total` },
    { label: "Points issued", value: pointsIssued.toLocaleString("en-US"), detail: `${members} ${members === 1 ? "member" : "members"}` },
    { label: "Membership tiers", value: String(tiers.length), detail: tiers.length ? tiers[tiers.length - 1].name : "None yet" },
  ];

  return {
    tenant: business,
    stats,
    campaigns: campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      channel: CHANNEL_LABELS[campaign.channel] ?? campaign.channel,
      type: TYPE_LABELS[campaign.type] ?? campaign.type,
      status: titleCase(campaign.status),
      statusKey: campaign.status,
      when: shortDate(campaign.scheduledAt),
    })),
    coupons: coupons.map((coupon) => ({
      id: coupon.id,
      code: coupon.code,
      discount: discountLabel(coupon.discountType, Number(coupon.value), currency),
      uses: coupon.maxUses != null ? `${coupon.usedCount}/${coupon.maxUses}` : String(coupon.usedCount),
      expiry: shortDate(coupon.expiresAt),
      active: coupon.active,
    })),
    tiers: tiers.map((tier) => ({
      id: tier.id,
      name: tier.name,
      threshold:
        tier.minSpend != null
          ? `${money(Number(tier.minSpend), currency)} spend`
          : tier.minPoints != null
            ? `${tier.minPoints} pts`
            : "—",
      discount: tier.discountPercent != null ? `${Number(tier.discountPercent)}%` : "—",
      perks: tier.perks ?? "—",
    })),
    loyalty: {
      pointsPerCurrencyUnit: program ? Number(program.pointsPerCurrencyUnit) : 1,
      redemptionRate: program ? Number(program.redemptionRate) : 1,
      active: program ? program.active : false,
      pointsIssued,
      members,
    },
    channels: CAMPAIGN_CHANNELS,
    types: CAMPAIGN_TYPES,
  };
}

export async function createCampaign({
  businessSlug,
  name,
  channel,
  type,
  scheduledAt,
  content,
}: {
  businessSlug: string;
  name: string;
  channel: string;
  type: string;
  scheduledAt: Date | null;
  content: string;
}) {
  if (!isDatabaseConfigured() || !name.trim() || !VALID_CHANNELS.has(channel) || !VALID_TYPES.has(type)) {
    return;
  }

  const business = await prisma.business.findUnique({ where: { slug: businessSlug }, select: { id: true } });
  if (!business) {
    return;
  }

  await prisma.campaign.create({
    data: {
      businessId: business.id,
      name: name.trim(),
      channel: channel as "EMAIL" | "SMS" | "WHATSAPP",
      type: type as "PROMO" | "BIRTHDAY" | "HOLIDAY" | "WINBACK" | "REFERRAL",
      status: scheduledAt ? "SCHEDULED" : "DRAFT",
      scheduledAt,
      content: content.trim() || null,
    },
  });
}

export async function createCoupon({
  businessSlug,
  code,
  discountType,
  value,
  maxUses,
  expiresAt,
}: {
  businessSlug: string;
  code: string;
  discountType: string;
  value: number;
  maxUses: number | null;
  expiresAt: Date | null;
}) {
  const normalizedCode = code.trim().toUpperCase().replace(/\s+/g, "");
  if (!isDatabaseConfigured() || !normalizedCode || !["PERCENT", "FIXED"].includes(discountType)) {
    return;
  }
  if (!Number.isFinite(value) || value <= 0 || (discountType === "PERCENT" && value > 100)) {
    return;
  }

  const business = await prisma.business.findUnique({ where: { slug: businessSlug }, select: { id: true } });
  if (!business) {
    return;
  }

  // Codes are unique per business — skip silently if it already exists.
  const existing = await prisma.coupon.findFirst({
    where: { businessId: business.id, code: normalizedCode },
    select: { id: true },
  });
  if (existing) {
    return;
  }

  await prisma.coupon.create({
    data: {
      businessId: business.id,
      code: normalizedCode,
      discountType: discountType as "PERCENT" | "FIXED",
      value,
      maxUses: maxUses != null && maxUses > 0 ? maxUses : null,
      expiresAt,
    },
  });
}

export async function toggleCoupon({ businessSlug, couponId }: { businessSlug: string; couponId: string }) {
  if (!isDatabaseConfigured()) {
    return;
  }
  const coupon = await prisma.coupon.findFirst({
    where: { id: couponId, business: { slug: businessSlug } },
    select: { id: true, active: true },
  });
  if (!coupon) {
    return;
  }
  await prisma.coupon.update({ where: { id: coupon.id }, data: { active: !coupon.active } });
}

export async function updateLoyaltyProgram({
  businessSlug,
  pointsPerCurrencyUnit,
  redemptionRate,
  active,
}: {
  businessSlug: string;
  pointsPerCurrencyUnit: number;
  redemptionRate: number;
  active: boolean;
}) {
  if (!isDatabaseConfigured()) {
    return;
  }
  const business = await prisma.business.findUnique({ where: { slug: businessSlug }, select: { id: true } });
  if (!business) {
    return;
  }

  const points = Number.isFinite(pointsPerCurrencyUnit) && pointsPerCurrencyUnit >= 0 ? pointsPerCurrencyUnit : 1;
  const redemption = Number.isFinite(redemptionRate) && redemptionRate >= 0 ? redemptionRate : 1;

  await prisma.loyaltyProgram.upsert({
    where: { businessId: business.id },
    update: { pointsPerCurrencyUnit: points, redemptionRate: redemption, active },
    create: { businessId: business.id, pointsPerCurrencyUnit: points, redemptionRate: redemption, active },
  });
}

export async function createTier({
  businessSlug,
  name,
  minSpend,
  discountPercent,
  perks,
}: {
  businessSlug: string;
  name: string;
  minSpend: number | null;
  discountPercent: number | null;
  perks: string;
}) {
  if (!isDatabaseConfigured() || !name.trim()) {
    return;
  }
  const business = await prisma.business.findUnique({ where: { slug: businessSlug }, select: { id: true } });
  if (!business) {
    return;
  }

  await prisma.clientTier.create({
    data: {
      businessId: business.id,
      name: name.trim(),
      minSpend: minSpend != null && minSpend >= 0 ? minSpend : null,
      discountPercent:
        discountPercent != null && discountPercent >= 0 && discountPercent <= 100 ? discountPercent : null,
      perks: perks.trim() || null,
    },
  });
}
