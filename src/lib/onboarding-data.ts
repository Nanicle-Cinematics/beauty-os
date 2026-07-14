import "server-only";

import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

export type OnboardingOption = { value: string; label: string };

export type OnboardingOptions = {
  categories: OnboardingOption[];
  plans: OnboardingOption[];
  currencies: OnboardingOption[];
  timezones: OnboardingOption[];
};

export type CreateBusinessResult = { ok: true; slug: string } | { ok: false; error: string };

export const CURRENCIES: OnboardingOption[] = [
  { value: "GHS", label: "GH₵ Ghana Cedi" },
  { value: "NGN", label: "₦ Nigerian Naira" },
  { value: "USD", label: "$ US Dollar" },
  { value: "GBP", label: "£ British Pound" },
  { value: "EUR", label: "€ Euro" },
];

export const TIMEZONES: OnboardingOption[] = [
  { value: "Africa/Accra", label: "Accra (GMT)" },
  { value: "Africa/Lagos", label: "Lagos (WAT)" },
  { value: "Europe/London", label: "London" },
  { value: "America/New_York", label: "New York" },
  { value: "UTC", label: "UTC" },
];

const VALID_CURRENCIES = new Set(CURRENCIES.map((c) => c.value));
const VALID_TIMEZONES = new Set(TIMEZONES.map((t) => t.value));

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function ensureUniqueSlug(base: string) {
  const existing = await prisma.business.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  const taken = new Set(existing.map((b) => b.slug));
  if (!taken.has(base)) {
    return base;
  }
  let n = 2;
  while (taken.has(`${base}-${n}`)) {
    n += 1;
  }
  return `${base}-${n}`;
}

export async function getOnboardingOptions(): Promise<OnboardingOptions> {
  if (!isDatabaseConfigured()) {
    return {
      categories: [
        { value: "sample_hair", label: "Hair, makeup, nails" },
        { value: "sample_lashes", label: "Lashes and brows" },
      ],
      plans: [
        { value: "sample_growth", label: "Growth Suite" },
        { value: "sample_studio", label: "Studio Pro" },
      ],
      currencies: CURRENCIES,
      timezones: TIMEZONES,
    };
  }

  const [categories, plans] = await Promise.all([
    prisma.businessCategory.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, label: true } }),
    prisma.plan.findMany({ where: { isActive: true }, orderBy: { priceMonthly: "asc" }, select: { id: true, name: true } }),
  ]);

  return {
    categories: categories.map((c) => ({ value: c.id, label: c.label })),
    plans: plans.map((p) => ({ value: p.id, label: p.name })),
    currencies: CURRENCIES,
    timezones: TIMEZONES,
  };
}

export async function createBusiness({
  name,
  slug,
  categoryId,
  currency,
  timezone,
  email,
  phone,
  ownerName,
  ownerEmail,
  ownerPassword,
  planId,
  actorUserId,
}: {
  name: string;
  slug: string;
  categoryId: string;
  currency: string;
  timezone: string;
  email: string;
  phone: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  planId: string;
  actorUserId: string | null;
}): Promise<CreateBusinessResult> {
  if (!isDatabaseConfigured()) {
    return { ok: false, error: "Database is not configured." };
  }

  const bizName = name.trim();
  const oName = ownerName.trim();
  const oEmail = ownerEmail.trim().toLowerCase();

  if (!bizName || !oName || !oEmail || !ownerPassword) {
    return { ok: false, error: "Business name, owner name, owner email and password are all required." };
  }
  if (!EMAIL_RE.test(oEmail)) {
    return { ok: false, error: "Enter a valid owner email address." };
  }
  if (ownerPassword.length < 8) {
    return { ok: false, error: "Owner password must be at least 8 characters." };
  }

  const safeCurrency = VALID_CURRENCIES.has(currency) ? currency : "GHS";
  const safeTimezone = VALID_TIMEZONES.has(timezone) ? timezone : "Africa/Accra";

  const category = await prisma.businessCategory.findFirst({ where: { id: categoryId, isActive: true }, select: { id: true } });
  if (!category) {
    return { ok: false, error: "Choose a business category." };
  }

  let planIdToUse: string | null = null;
  if (planId) {
    const plan = await prisma.plan.findFirst({ where: { id: planId, isActive: true }, select: { id: true } });
    if (!plan) {
      return { ok: false, error: "The selected plan is unavailable." };
    }
    planIdToUse = plan.id;
  }

  const existingUser = await prisma.user.findUnique({ where: { email: oEmail }, select: { id: true } });
  if (existingUser) {
    return { ok: false, error: "An account with that owner email already exists." };
  }

  const base = (slug.trim() ? slugify(slug) : slugify(bizName)) || "business";
  const uniqueSlug = await ensureUniqueSlug(base);
  const passwordHash = await hashPassword(ownerPassword);
  const now = new Date();

  try {
    const created = await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          slug: uniqueSlug,
          name: bizName,
          categoryId: category.id,
          currency: safeCurrency,
          timezone: safeTimezone,
          email: email.trim() || null,
          phone: phone.trim() || null,
          status: "TRIAL",
        },
      });

      const owner = await tx.user.create({
        data: { email: oEmail, name: oName, passwordHash, isPlatformAdmin: false },
      });

      await tx.staffMember.create({
        data: {
          businessId: business.id,
          userId: owner.id,
          invitedEmail: oEmail,
          role: "OWNER",
          status: "ACTIVE",
          joinedAt: now,
        },
      });

      if (planIdToUse) {
        await tx.subscription.create({
          data: {
            businessId: business.id,
            planId: planIdToUse,
            billingCycle: "MONTHLY",
            status: "TRIALING",
            trialEndsAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          businessId: business.id,
          actorUserId,
          action: "business.created",
          entityType: "Business",
          entityId: business.id,
          metadata: { slug: uniqueSlug, ownerEmail: oEmail },
        },
      });

      return business;
    });

    return { ok: true, slug: created.slug };
  } catch {
    // Unique-constraint races (slug/email) or any write failure land here.
    return { ok: false, error: "Could not create the business. Please try again." };
  }
}
