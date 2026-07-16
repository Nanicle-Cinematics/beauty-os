import "server-only";

import { prisma, tenantTransaction, isDatabaseConfigured } from "@/lib/prisma";
import { CURRENCIES, TIMEZONES } from "@/lib/onboarding-data";

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
};

const s = (v: string | null | undefined) => v ?? "";

export async function getBusinessSettings(slug: string): Promise<BusinessSettings | null> {
  if (!isDatabaseConfigured()) return null;

  const business = await prisma.business.findUnique({
    where: { slug },
    include: { hours: true },
  });
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
};

export async function updateBusinessDetails(input: BusinessDetailsInput): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Not available." };

  const name = input.name.trim();
  if (name.length < 2) return { ok: false, error: "Business name is required." };

  const email = nullify(input.email);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "Enter a valid contact email." };
  }
  const logoUrl = nullify(input.logoUrl);
  if (logoUrl && !/^https?:\/\//i.test(logoUrl)) {
    return { ok: false, error: "Logo URL must start with http:// or https://." };
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
