import "server-only";

import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { isSmsConfigured, isWhatsappConfigured } from "@/lib/messaging";
import { sendEmail, escapeHtml } from "@/lib/email";
import { sendSms, sendWhatsapp } from "@/lib/messaging";

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

/**
 * Channels currently OFFERED for new campaigns. Email always works (SMTP/Resend/
 * dry-run). SMS and WhatsApp are paid and hidden until their transports are
 * configured — showing a channel the studio can't actually send on just promises
 * what it can't deliver. They reappear automatically once the Twilio / WhatsApp
 * credentials are set. See docs/MESSAGING.md.
 */
export function availableChannels() {
  return CAMPAIGN_CHANNELS.filter((c) => {
    if (c.value === "SMS") return isSmsConfigured();
    if (c.value === "WHATSAPP") return isWhatsappConfigured();
    return true; // EMAIL
  });
}

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
    channels: availableChannels(),
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
    channels: availableChannels(),
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
    channels: availableChannels(),
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

// ── Editing (item 14) ───────────────────────────────────────────────────────

export type MarketingWriteResult = { ok: true } | { ok: false; error: string };

export type CampaignDetail = {
  id: string;
  name: string;
  channel: string;
  type: string;
  status: string;
  scheduledAtLocal: string;
  content: string;
  /** SENT campaigns are history — the edit form is read-only for them. */
  editable: boolean;
};

export type CouponDetail = {
  id: string;
  code: string;
  discountType: string;
  value: string;
  maxUses: string;
  usedCount: number;
  expiresAtLocal: string;
  active: boolean;
  currency: string;
};

export type TierDetail = {
  id: string;
  name: string;
  minPoints: string;
  minSpend: string;
  discountPercent: string;
  perks: string;
  currency: string;
};

const CAMPAIGN_STATUSES = ["DRAFT", "SCHEDULED", "SENT", "CANCELLED"];

function toDateInput(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "";
}

/* ---- Campaign ---- */

export async function getCampaignDetail(businessSlug: string, campaignId: string): Promise<CampaignDetail | null> {
  if (!isDatabaseConfigured()) return null;
  const c = await prisma.campaign.findFirst({ where: { id: campaignId, business: { slug: businessSlug } } });
  if (!c) return null;
  return {
    id: c.id,
    name: c.name,
    channel: c.channel,
    type: c.type,
    status: c.status,
    scheduledAtLocal: toDateInput(c.scheduledAt),
    content: c.content ?? "",
    editable: c.status !== "SENT",
  };
}

export async function updateCampaign(input: {
  businessSlug: string;
  campaignId: string;
  name: string;
  channel: string;
  type: string;
  status: string;
  scheduledAt: Date | null;
  content: string;
}): Promise<MarketingWriteResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Database not configured" };
  if (!input.name.trim()) return { ok: false, error: "A campaign name is required." };
  if (!VALID_CHANNELS.has(input.channel)) return { ok: false, error: "Invalid channel." };
  if (!VALID_TYPES.has(input.type)) return { ok: false, error: "Invalid campaign type." };
  if (!CAMPAIGN_STATUSES.includes(input.status)) return { ok: false, error: "Invalid status." };

  const existing = await prisma.campaign.findFirst({
    where: { id: input.campaignId, business: { slug: input.businessSlug } },
    select: { id: true, status: true },
  });
  if (!existing) return { ok: false, error: "That campaign no longer exists." };
  // A sent campaign is a record of what actually went out — it must not be
  // rewritten after the fact.
  if (existing.status === "SENT") return { ok: false, error: "A sent campaign can't be edited — it's a record of what went out." };

  await prisma.campaign.update({
    where: { id: existing.id },
    data: {
      name: input.name.trim(),
      channel: input.channel as "EMAIL" | "SMS" | "WHATSAPP",
      type: input.type as "BIRTHDAY" | "HOLIDAY" | "PROMO" | "WINBACK" | "REFERRAL",
      status: input.status as "DRAFT" | "SCHEDULED" | "SENT" | "CANCELLED",
      scheduledAt: input.scheduledAt,
      content: input.content.trim() || null,
    },
  });
  return { ok: true };
}

export async function deleteCampaign(businessSlug: string, campaignId: string): Promise<MarketingWriteResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Database not configured" };
  const c = await prisma.campaign.findFirst({
    where: { id: campaignId, business: { slug: businessSlug } },
    select: { id: true, status: true },
  });
  if (!c) return { ok: false, error: "That campaign no longer exists." };
  if (c.status === "SENT") return { ok: false, error: "A sent campaign is part of your marketing history and can't be deleted." };
  await prisma.campaign.delete({ where: { id: c.id } });
  return { ok: true };
}

/* ---- Coupon ---- */

export async function getCouponDetail(businessSlug: string, couponId: string): Promise<CouponDetail | null> {
  if (!isDatabaseConfigured()) return null;
  const c = await prisma.coupon.findFirst({
    where: { id: couponId, business: { slug: businessSlug } },
    include: { business: { select: { currency: true } } },
  });
  if (!c) return null;
  return {
    id: c.id,
    code: c.code,
    discountType: c.discountType,
    value: String(c.value),
    maxUses: c.maxUses != null ? String(c.maxUses) : "",
    usedCount: c.usedCount,
    expiresAtLocal: toDateInput(c.expiresAt),
    active: c.active,
    currency: c.business.currency,
  };
}

export async function updateCoupon(input: {
  businessSlug: string;
  couponId: string;
  code: string;
  discountType: string;
  value: number;
  maxUses: number | null;
  expiresAt: Date | null;
  active: boolean;
}): Promise<MarketingWriteResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Database not configured" };
  const code = input.code.trim().toUpperCase();
  if (!code) return { ok: false, error: "A coupon code is required." };
  if (!["PERCENT", "FIXED"].includes(input.discountType)) return { ok: false, error: "Invalid discount type." };
  if (!Number.isFinite(input.value) || input.value <= 0) return { ok: false, error: "Enter a discount value." };
  if (input.discountType === "PERCENT" && input.value > 100) return { ok: false, error: "A percentage discount can't exceed 100." };

  const coupon = await prisma.coupon.findFirst({
    where: { id: input.couponId, business: { slug: input.businessSlug } },
    select: { id: true, businessId: true, usedCount: true },
  });
  if (!coupon) return { ok: false, error: "That coupon no longer exists." };

  // Codes are unique per business — a redeeming client types the code, so two
  // coupons sharing one would be ambiguous.
  const clash = await prisma.coupon.findFirst({
    where: { businessId: coupon.businessId, code, id: { not: coupon.id } },
    select: { id: true },
  });
  if (clash) return { ok: false, error: `Another coupon already uses the code ${code}.` };

  // maxUses can't drop below what's already been redeemed — that would make the
  // coupon retroactively over-used.
  if (input.maxUses != null && input.maxUses < coupon.usedCount) {
    return { ok: false, error: `This coupon has already been used ${coupon.usedCount} times; the limit can't be lower.` };
  }

  await prisma.coupon.update({
    where: { id: coupon.id },
    data: {
      code,
      discountType: input.discountType as "PERCENT" | "FIXED",
      value: input.value,
      maxUses: input.maxUses != null && input.maxUses > 0 ? input.maxUses : null,
      expiresAt: input.expiresAt,
      active: input.active,
    },
  });
  return { ok: true };
}

export async function deleteCoupon(businessSlug: string, couponId: string): Promise<MarketingWriteResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Database not configured" };
  const c = await prisma.coupon.findFirst({
    where: { id: couponId, business: { slug: businessSlug } },
    select: { id: true, usedCount: true },
  });
  if (!c) return { ok: false, error: "That coupon no longer exists." };
  // A redeemed coupon is part of the discount record — deactivate, don't delete.
  if (c.usedCount > 0) {
    return { ok: false, error: `This coupon has been redeemed ${c.usedCount} times. Deactivate it instead of deleting.` };
  }
  await prisma.coupon.delete({ where: { id: c.id } });
  return { ok: true };
}

/* ---- Tier ---- */

export async function getTierDetail(businessSlug: string, tierId: string): Promise<TierDetail | null> {
  if (!isDatabaseConfigured()) return null;
  const t = await prisma.clientTier.findFirst({
    where: { id: tierId, business: { slug: businessSlug } },
    include: { business: { select: { currency: true } } },
  });
  if (!t) return null;
  return {
    id: t.id,
    name: t.name,
    minPoints: t.minPoints != null ? String(t.minPoints) : "",
    minSpend: t.minSpend != null ? String(t.minSpend) : "",
    discountPercent: t.discountPercent != null ? String(t.discountPercent) : "",
    perks: t.perks ?? "",
    currency: t.business.currency,
  };
}

export async function updateTier(input: {
  businessSlug: string;
  tierId: string;
  name: string;
  minPoints: number | null;
  minSpend: number | null;
  discountPercent: number | null;
  perks: string;
}): Promise<MarketingWriteResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Database not configured" };
  if (!input.name.trim()) return { ok: false, error: "A tier name is required." };
  if (input.discountPercent != null && (input.discountPercent < 0 || input.discountPercent > 100)) {
    return { ok: false, error: "A tier discount must be between 0 and 100." };
  }

  const tier = await prisma.clientTier.findFirst({
    where: { id: input.tierId, business: { slug: input.businessSlug } },
    select: { id: true },
  });
  if (!tier) return { ok: false, error: "That tier no longer exists." };

  await prisma.clientTier.update({
    where: { id: tier.id },
    data: {
      name: input.name.trim(),
      minPoints: input.minPoints != null && input.minPoints >= 0 ? input.minPoints : null,
      minSpend: input.minSpend != null && input.minSpend >= 0 ? input.minSpend : null,
      discountPercent: input.discountPercent,
      perks: input.perks.trim() || null,
    },
  });
  return { ok: true };
}

export async function deleteTier(businessSlug: string, tierId: string): Promise<MarketingWriteResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Database not configured" };
  const { count } = await prisma.clientTier.deleteMany({ where: { id: tierId, business: { slug: businessSlug } } });
  return count > 0 ? { ok: true } : { ok: false, error: "That tier no longer exists." };
}

// ── Sending campaigns (item: wire the channels) ─────────────────────────────

export type CampaignSendResult =
  | { ok: true; recipients: number; dryRun: boolean; channel: string }
  | { ok: false; error: string };

/**
 * Dispatch a campaign to its opted-in audience over the campaign's channel.
 *
 * Consent is respected per channel — a client who opted out of SMS is never
 * texted, even if they're opted in to email — and a recipient without the
 * relevant contact detail is skipped. Sending stays dry-run (logged, no real
 * message) until the channel's transport is configured, so this is safe to run
 * before Twilio / WhatsApp credentials exist. Marking the campaign SENT makes it
 * read-only (financial-history-style: a sent campaign is a record of what went
 * out — see updateCampaign).
 */
export async function sendCampaign(businessSlug: string, campaignId: string): Promise<CampaignSendResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Database not configured" };

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, business: { slug: businessSlug } },
    include: { business: { select: { id: true, name: true, email: true } } },
  });
  if (!campaign) return { ok: false, error: "That campaign no longer exists." };
  if (campaign.status === "SENT") return { ok: false, error: "This campaign has already been sent." };
  if (!campaign.content || !campaign.content.trim()) {
    return { ok: false, error: "Add a message before sending." };
  }

  const channel = campaign.channel as "EMAIL" | "SMS" | "WHATSAPP";
  const consentField =
    channel === "EMAIL" ? "marketingOptInEmail" : channel === "SMS" ? "marketingOptInSms" : "marketingOptInWhatsapp";

  const recipients = await prisma.customer.findMany({
    where: { businessId: campaign.business.id, archivedAt: null, [consentField]: true },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true },
    take: 2000,
  });

  const body = campaign.content.trim();
  const subject = campaign.name;
  const businessId = campaign.business.id;

  let sent = 0;
  let dryRun = false;
  for (const r of recipients) {
    const to = channel === "EMAIL" ? r.email : r.phone;
    if (!to) continue; // no contact detail on that channel — skip, never guess

    if (channel === "EMAIL") {
      const safe = escapeHtml(body).replace(/\n/g, "<br>");
      const res = await sendEmail({
        to,
        subject,
        html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#231c22;line-height:22px">${safe}</div>`,
        text: body,
        type: "campaign",
        businessId,
        customerId: r.id,
        // Client-facing: show the salon as sender, replies go to the salon.
        fromName: campaign.business.name,
        replyTo: campaign.business.email,
      });
      if (res.ok) sent += 1;
      dryRun = dryRun || res.dryRun;
    } else if (channel === "SMS") {
      const res = await sendSms({ to, body, type: "campaign", businessId, customerId: r.id });
      if (res.ok) sent += 1;
      dryRun = dryRun || res.dryRun;
    } else {
      const res = await sendWhatsapp({ to, body, type: "campaign", businessId, customerId: r.id });
      if (res.ok) sent += 1;
      dryRun = dryRun || res.dryRun;
    }
  }

  await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "SENT" } });

  return { ok: true, recipients: sent, dryRun, channel };
}
