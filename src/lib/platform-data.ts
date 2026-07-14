import "server-only";

import { prisma, isDatabaseConfigured } from "@/lib/prisma";

export type PlatformStat = { label: string; value: string; detail: string };

export type PlatformBusinessRow = {
  id: string;
  slug: string;
  name: string;
  category: string;
  planName: string;
  planId: string | null;
  subscriptionStatus: string | null;
  subscriptionStatusKey: string | null;
  status: string;
  statusKey: string;
  staff: number;
  customers: number;
  created: string;
};

export type PlatformPlanRow = {
  id: string;
  key: string;
  name: string;
  price: string;
  subscribers: number;
  active: boolean;
};

export type PlatformActivityRow = {
  id: string;
  when: string;
  actor: string;
  action: string;
  target: string;
};

export type PlatformOverview = {
  stats: PlatformStat[];
  businesses: PlatformBusinessRow[];
  plans: PlatformPlanRow[];
  activity: PlatformActivityRow[];
  statusOptions: { value: string; label: string }[];
  planOptions: { value: string; label: string }[];
};

export const BUSINESS_STATUSES = [
  { value: "TRIAL", label: "Trial" },
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "CLOSED", label: "Closed" },
];

const VALID_STATUSES = new Set(BUSINESS_STATUSES.map((s) => s.value));

const ACTION_LABELS: Record<string, string> = {
  "business.created": "Onboarded business",
  "business.status_changed": "Changed status",
  "business.plan_changed": "Changed plan",
};

function money(amount: number) {
  return `GH₵ ${Math.round(amount).toLocaleString("en-US")}`;
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
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function relative(date: Date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return shortDate(date);
}

// Monthly-recurring contribution of one subscription, in GH₵.
function monthlyValue(priceMonthly: number, priceYearly: number, cycle: string) {
  return cycle === "YEARLY" ? priceYearly / 12 : priceMonthly;
}

const fallbackOverview: PlatformOverview = {
  stats: [
    { label: "Businesses", value: "42", detail: "34 active · 8 trial" },
    { label: "Monthly recurring revenue", value: "GH₵ 38,600", detail: "8 trialing" },
    { label: "Staff seats", value: "312", detail: "Active tenant users" },
    { label: "Clients", value: "12,940", detail: "Across every tenant" },
  ],
  businesses: [
    {
      id: "sample_osu_glow", slug: "osu-glow-studio", name: "Osu Glow Studio", category: "Hair, makeup, nails",
      planName: "Studio Pro", planId: "sample_studio", subscriptionStatus: "Active", subscriptionStatusKey: "ACTIVE",
      status: "Active", statusKey: "ACTIVE", staff: 6, customers: 214, created: "12 Jan 2026",
    },
    {
      id: "sample_luxe_lash", slug: "luxe-lash-lab", name: "Luxe Lash Lab", category: "Lashes and brows",
      planName: "Growth Suite", planId: "sample_growth", subscriptionStatus: "Trialing", subscriptionStatusKey: "TRIALING",
      status: "Trial", statusKey: "TRIAL", staff: 3, customers: 88, created: "03 Mar 2026",
    },
  ],
  plans: [
    { id: "sample_growth", key: "PROFESSIONAL", name: "Growth Suite", price: "GH₵ 199", subscribers: 1, active: true },
    { id: "sample_studio", key: "STUDIO", name: "Studio Pro", price: "GH₵ 349", subscribers: 1, active: true },
  ],
  activity: [],
  statusOptions: BUSINESS_STATUSES,
  planOptions: [
    { value: "sample_growth", label: "Growth Suite" },
    { value: "sample_studio", label: "Studio Pro" },
  ],
};

export async function getPlatformOverview(): Promise<PlatformOverview> {
  if (!isDatabaseConfigured()) {
    return fallbackOverview;
  }

  const [businesses, plans, totalCustomers, activeStaff, recentAudit] = await Promise.all([
    prisma.business.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        category: { select: { label: true } },
        subscription: { include: { plan: true } },
        _count: { select: { staff: true, customers: true } },
      },
    }),
    prisma.plan.findMany({
      orderBy: { priceMonthly: "asc" },
      include: { _count: { select: { subscriptions: true } } },
    }),
    prisma.customer.count(),
    prisma.staffMember.count({ where: { status: "ACTIVE" } }),
    prisma.auditLog.findMany({
      where: { entityType: "Business" },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { business: { select: { name: true } }, actorUser: { select: { email: true } } },
    }),
  ]);

  const activeCount = businesses.filter((b) => b.status === "ACTIVE").length;
  const trialCount = businesses.filter((b) => b.status === "TRIAL").length;
  const suspendedCount = businesses.filter((b) => b.status === "SUSPENDED").length;

  const mrr = businesses.reduce((sum, b) => {
    const sub = b.subscription;
    if (!sub || sub.status !== "ACTIVE") {
      return sum;
    }
    return sum + monthlyValue(Number(sub.plan.priceMonthly), Number(sub.plan.priceYearly), sub.billingCycle);
  }, 0);
  const trialingSubs = businesses.filter((b) => b.subscription?.status === "TRIALING").length;

  const stats: PlatformStat[] = [
    {
      label: "Businesses",
      value: String(businesses.length),
      detail: `${activeCount} active · ${trialCount} trial${suspendedCount ? ` · ${suspendedCount} suspended` : ""}`,
    },
    { label: "Monthly recurring revenue", value: money(mrr), detail: `${trialingSubs} trialing` },
    { label: "Staff seats", value: String(activeStaff), detail: "Active tenant users" },
    { label: "Clients", value: totalCustomers.toLocaleString("en-US"), detail: "Across every tenant" },
  ];

  return {
    stats,
    businesses: businesses.map((b) => ({
      id: b.id,
      slug: b.slug,
      name: b.name,
      category: b.category.label,
      planName: b.subscription?.plan.name ?? "No plan",
      planId: b.subscription?.planId ?? null,
      subscriptionStatus: b.subscription ? titleCase(b.subscription.status) : null,
      subscriptionStatusKey: b.subscription?.status ?? null,
      status: titleCase(b.status),
      statusKey: b.status,
      staff: b._count.staff,
      customers: b._count.customers,
      created: shortDate(b.createdAt),
    })),
    plans: plans.map((p) => ({
      id: p.id,
      key: p.key,
      name: p.name,
      price: money(Number(p.priceMonthly)),
      subscribers: p._count.subscriptions,
      active: p.isActive,
    })),
    activity: recentAudit.map((a) => {
      const meta = (a.metadata ?? {}) as Record<string, unknown>;
      const detail = typeof meta.status === "string" ? meta.status : typeof meta.planName === "string" ? meta.planName : "";
      return {
        id: a.id,
        when: relative(a.createdAt),
        actor: a.actorUser?.email ?? "System",
        action: ACTION_LABELS[a.action] ?? a.action,
        target: `${a.business?.name ?? "—"}${detail ? ` → ${titleCase(detail)}` : ""}`,
      };
    }),
    statusOptions: BUSINESS_STATUSES,
    planOptions: plans.filter((p) => p.isActive).map((p) => ({ value: p.id, label: p.name })),
  };
}

export async function setBusinessStatus({
  businessId,
  status,
  actorUserId,
}: {
  businessId: string;
  status: string;
  actorUserId: string | null;
}) {
  if (!isDatabaseConfigured() || !VALID_STATUSES.has(status)) {
    return;
  }
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { id: true, status: true } });
  if (!business || business.status === status) {
    return;
  }

  await prisma.$transaction([
    prisma.business.update({
      where: { id: business.id },
      data: { status: status as "TRIAL" | "ACTIVE" | "SUSPENDED" | "CLOSED" },
    }),
    prisma.auditLog.create({
      data: {
        businessId: business.id,
        actorUserId,
        action: "business.status_changed",
        entityType: "Business",
        entityId: business.id,
        metadata: { from: business.status, status },
      },
    }),
  ]);
}

export async function changeBusinessPlan({
  businessId,
  planId,
  actorUserId,
}: {
  businessId: string;
  planId: string;
  actorUserId: string | null;
}) {
  if (!isDatabaseConfigured()) {
    return;
  }
  const [business, plan] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, subscription: { select: { id: true, planId: true } } },
    }),
    prisma.plan.findFirst({ where: { id: planId, isActive: true }, select: { id: true, name: true } }),
  ]);
  if (!business || !plan) {
    return;
  }
  if (business.subscription?.planId === plan.id) {
    return;
  }

  await prisma.$transaction([
    business.subscription
      ? prisma.subscription.update({ where: { id: business.subscription.id }, data: { planId: plan.id } })
      : prisma.subscription.create({
          data: { businessId: business.id, planId: plan.id, billingCycle: "MONTHLY", status: "TRIALING" },
        }),
    prisma.auditLog.create({
      data: {
        businessId: business.id,
        actorUserId,
        action: "business.plan_changed",
        entityType: "Business",
        entityId: business.id,
        metadata: { planId: plan.id, planName: plan.name },
      },
    }),
  ]);
}
