import "server-only";

import { prisma, tenantTransaction, isDatabaseConfigured } from "@/lib/prisma";
import { setTenantContext } from "@/lib/tenant-context";
import { hashPassword } from "@/lib/password";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function money(amount: number) {
  return `GH₵ ${Math.round(amount).toLocaleString("en-US")}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function ensureUniqueSlug(base: string) {
  const existing = await prisma.business.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } });
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

export type PublicPlan = {
  key: string;
  name: string;
  priceMonthly: string;
  priceYearly: string;
  features: string[];
  highlighted: boolean;
};

const fallbackPlans: PublicPlan[] = [
  { key: "PROFESSIONAL", name: "Growth Suite", priceMonthly: "GH₵ 199", priceYearly: "GH₵ 1,990", features: ["Bookings", "CRM", "Marketing"], highlighted: false },
  { key: "STUDIO", name: "Studio Pro", priceMonthly: "GH₵ 349", priceYearly: "GH₵ 3,490", features: ["Bookings", "CRM", "Inventory", "Payments"], highlighted: true },
];

export async function getPublicPlans(): Promise<PublicPlan[]> {
  if (!isDatabaseConfigured()) {
    return fallbackPlans;
  }
  const plans = await prisma.plan.findMany({ where: { isActive: true }, orderBy: { priceMonthly: "asc" } });
  return plans.map((p, i) => ({
    key: p.key,
    name: p.name,
    priceMonthly: money(Number(p.priceMonthly)),
    priceYearly: money(Number(p.priceYearly)),
    features: Array.isArray(p.features) ? (p.features as unknown[]).map(String) : [],
    // Highlight the top (most expensive) active plan as the recommended tier.
    highlighted: i === plans.length - 1,
  }));
}

export type PublicCategory = { id: string; label: string };

const fallbackCategories: PublicCategory[] = [
  { id: "sample_hair", label: "Hair, makeup, nails" },
  { id: "sample_lashes", label: "Lashes and brows" },
];

export async function getSignupCategories(): Promise<PublicCategory[]> {
  if (!isDatabaseConfigured()) {
    return fallbackCategories;
  }
  const categories = await prisma.businessCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, label: true },
  });
  return categories;
}

export type SignUpResult =
  | { ok: true; slug: string; userId: string; businessId: string; ownerEmail: string; ownerName: string }
  | { ok: false; error: string };

// Public self-serve signup: creates the business, the owner's User (with the
// password they chose), and an ACTIVE OWNER membership in one transaction, then
// returns the userId so the caller can log them straight in. Unlike admin
// onboarding there is no invite indirection — the owner is present and setting
// their own password right now.
export async function signUpBusiness({
  businessName,
  categoryId,
  ownerName,
  ownerEmail,
  ownerPassword,
}: {
  businessName: string;
  categoryId: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
}): Promise<SignUpResult> {
  if (!isDatabaseConfigured()) {
    return { ok: false, error: "Signups are temporarily unavailable. Please try again shortly." };
  }

  // Public, pre-tenant path that creates a brand-new business + owner — must run
  // with RLS bypassed (there is no "current tenant" yet).
  setTenantContext({ bypass: true });

  const bizName = businessName.trim();
  const oName = ownerName.trim();
  const oEmail = ownerEmail.trim().toLowerCase();

  if (!bizName || !oName || !oEmail || !ownerPassword) {
    return { ok: false, error: "Business name, your name, email and password are all required." };
  }
  if (!EMAIL_RE.test(oEmail)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (ownerPassword.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const category = await prisma.businessCategory.findFirst({ where: { id: categoryId, isActive: true }, select: { id: true } });
  if (!category) {
    return { ok: false, error: "Choose the type of business you run." };
  }

  const existingUser = await prisma.user.findUnique({ where: { email: oEmail }, select: { id: true } });
  if (existingUser) {
    return { ok: false, error: "An account with that email already exists — sign in instead." };
  }

  const uniqueSlug = await ensureUniqueSlug(slugify(bizName) || "studio");
  const passwordHash = await hashPassword(ownerPassword);
  const now = new Date();

  try {
    const result = await tenantTransaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          slug: uniqueSlug,
          name: bizName,
          categoryId: category.id,
          currency: "GHS",
          timezone: "Africa/Accra",
          status: "TRIAL",
        },
      });

      const owner = await tx.user.create({
        data: { email: oEmail, name: oName, passwordHash, isPlatformAdmin: false, emailVerifiedAt: null },
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

      await tx.auditLog.create({
        data: {
          businessId: business.id,
          actorUserId: owner.id,
          action: "business.created",
          entityType: "Business",
          entityId: business.id,
          metadata: { slug: uniqueSlug, ownerEmail: oEmail, source: "self_signup" },
        },
      });

      return { slug: business.slug, userId: owner.id, businessId: business.id };
    }, { timeout: 15000 });

    return { ok: true, slug: result.slug, userId: result.userId, businessId: result.businessId, ownerEmail: oEmail, ownerName: oName };
  } catch {
    return { ok: false, error: "Could not create your workspace. Please try again." };
  }
}
