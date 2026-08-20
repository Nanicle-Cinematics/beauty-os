import "server-only";

import { prisma, tenantTransaction, isDatabaseConfigured } from "@/lib/prisma";
import { CURRENCIES, TIMEZONES } from "@/lib/onboarding-data";
import { planFeatureList, isPlanKey, TOP_PLAN } from "@/lib/entitlements";

const VALID_CURRENCIES = new Set(CURRENCIES.map((c) => c.value));
const VALID_TIMEZONES = new Set(TIMEZONES.map((t) => t.value));

// 0 = Sunday … 6 = Saturday (matches BusinessHours.dayOfWeek + the dashboard).
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export type DayHours = { dayOfWeek: number; isClosed: boolean; openTime: string; closeTime: string };

export type BusinessSettings = {
  slug: string;
  name: string;
  description: string;
  email: string;
  phone: string;
  logoUrl: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  country: string;
  timezone: string;
  currency: string;
  taxRate: string;
  taxId: string;
  hours: DayHours[];
  subscription: {
    planName: string;
    status: string;
    billingCycle: string;
    trialEndsAt: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  } | null;
  plans: {
    id: string;
    name: string;
    key: string;
    priceMonthly: string;
    priceYearly: string;
    features: string[];
    current: boolean;
  }[];
};

const s = (v: string | null | undefined) => v ?? "";

function money(amount: { toString(): string }, currency = "GHS") {
  const symbol = currency === "GHS" ? "GH₵" : currency;
  return `${symbol} ${Number(amount.toString()).toLocaleString("en-US")}`;
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function shortDate(date: Date | null | undefined) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

/**
 * What a plan includes, derived from the entitlement ladder rather than the
 * `Plan.features` JSON column.
 *
 * That column was hand-maintained marketing copy which nothing enforced, and it
 * drifted: Growth Suite listed Marketing while the dearer Studio Pro did not.
 * Deriving it means a bullet cannot outlive the access it describes. The old
 * slice-to-4 is gone with it — the list is now exactly as long as the tier is.
 */
function featureList(planKey: string, previousPlanName: string | null) {
  return planFeatureList(isPlanKey(planKey) ? planKey : TOP_PLAN, previousPlanName);
}

export async function getBusinessSettings(slug: string): Promise<BusinessSettings | null> {
  if (!isDatabaseConfigured()) return null;

  const [business, plans] = await Promise.all([
    prisma.business.findUnique({
      where: { slug },
      include: { hours: true, subscription: { include: { plan: true } } },
    }),
    prisma.plan.findMany({ where: { isActive: true }, orderBy: { priceMonthly: "asc" } }),
  ]);
  if (!business) return null;

  const byDay = new Map(business.hours.map((h) => [h.dayOfWeek, h]));
  const hours: DayHours[] = WEEKDAYS.map((_label, day) => {
    const h = byDay.get(day);
    return {
      dayOfWeek: day,
      isClosed: h?.isClosed ?? (day === 0), // default Sunday closed, rest open
      openTime: s(h?.openTime) || "09:00",
      closeTime: s(h?.closeTime) || "17:00",
    };
  });

  return {
    slug: business.slug,
    name: business.name,
    description: s(business.description),
    email: s(business.email),
    phone: s(business.phone),
    logoUrl: s(business.logoUrl),
    addressLine1: s(business.addressLine1),
    addressLine2: s(business.addressLine2),
    city: s(business.city),
    region: s(business.region),
    country: s(business.country),
    timezone: business.timezone,
    currency: business.currency,
    taxRate: business.taxRate != null ? String(Number(business.taxRate)) : "",
    taxId: s(business.taxId),
    hours,
    subscription: business.subscription
      ? {
          planName: business.subscription.plan.name,
          status: titleCase(business.subscription.status),
          billingCycle: titleCase(business.subscription.billingCycle),
          trialEndsAt: shortDate(business.subscription.trialEndsAt),
          currentPeriodEnd: shortDate(business.subscription.currentPeriodEnd),
          cancelAtPeriodEnd: business.subscription.cancelAtPeriodEnd,
        }
      : null,
    plans: plans.map((plan, i) => ({
      id: plan.id,
      name: plan.name,
      key: titleCase(plan.key),
      priceMonthly: money(plan.priceMonthly, business.currency),
      priceYearly: money(plan.priceYearly, business.currency),
      features: featureList(plan.key, i > 0 ? plans[i - 1].name : null),
      current: business.subscription?.planId === plan.id,
    })),
  };
}

const nullify = (v: string) => {
  const t = v.trim();
  return t === "" ? null : t;
};

export type BusinessDetailsInput = {
  slug: string;
  name: string;
  description: string;
  email: string;
  phone: string;
  logoUrl: string | null;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  country: string;
  timezone: string;
  currency: string;
  taxRate: string;
  taxId: string;
};

export async function updateBusinessDetails(input: BusinessDetailsInput): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Not available." };

  const name = input.name.trim();
  if (name.length < 2) return { ok: false, error: "Business name is required." };

  const email = nullify(input.email);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "Enter a valid contact email." };
  }
  const logoUrl = input.logoUrl?.trim() || null;
  if (logoUrl && !/^(https?:\/\/|data:image\/)/i.test(logoUrl)) {
    return { ok: false, error: "Workspace picture must be an image URL or uploaded image." };
  }

  const currency = VALID_CURRENCIES.has(input.currency) ? input.currency : "GHS";
  const timezone = VALID_TIMEZONES.has(input.timezone) ? input.timezone : "Africa/Accra";

  let taxRate: number | null = null;
  if (input.taxRate.trim() !== "") {
    taxRate = Number(input.taxRate);
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
      return { ok: false, error: "Tax rate must be a number between 0 and 100." };
    }
  }

  await prisma.business.update({
    where: { slug: input.slug },
    data: {
      name,
      description: nullify(input.description),
      email,
      phone: nullify(input.phone),
      logoUrl,
      addressLine1: nullify(input.addressLine1),
      addressLine2: nullify(input.addressLine2),
      city: nullify(input.city),
      region: nullify(input.region),
      country: nullify(input.country),
      timezone,
      currency,
      taxRate,
      taxId: nullify(input.taxId),
      // Saving real details also clears the "name your studio" nudge.
      namePlaceholder: false,
    },
  });
  return { ok: true };
}

export async function updateBusinessHours(slug: string, days: DayHours[]): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Not available." };

  const business = await prisma.business.findUnique({ where: { slug }, select: { id: true } });
  if (!business) return { ok: false, error: "Business not found." };

  const clean = days.map((d) => {
    const openTime = /^\d{2}:\d{2}$/.test(d.openTime) ? d.openTime : "09:00";
    const closeTime = /^\d{2}:\d{2}$/.test(d.closeTime) ? d.closeTime : "17:00";
    return { dayOfWeek: d.dayOfWeek, isClosed: d.isClosed, openTime, closeTime };
  });

  await tenantTransaction(async (tx) => {
    for (const d of clean) {
      await tx.businessHours.upsert({
        where: { businessId_dayOfWeek: { businessId: business.id, dayOfWeek: d.dayOfWeek } },
        create: {
          businessId: business.id,
          dayOfWeek: d.dayOfWeek,
          isClosed: d.isClosed,
          openTime: d.isClosed ? null : d.openTime,
          closeTime: d.isClosed ? null : d.closeTime,
        },
        update: {
          isClosed: d.isClosed,
          openTime: d.isClosed ? null : d.openTime,
          closeTime: d.isClosed ? null : d.closeTime,
        },
      });
    }
  }, { timeout: 15000 });

  return { ok: true };
}
