import "server-only";

import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import type { AppUser } from "@/lib/auth";

export type WorkspaceSummary = {
  name: string;
  slug: string;
  category: string;
  plan: string;
  status: string;
};

export type PlatformBusiness = {
  name: string;
  slug: string;
  plan: string;
  status: string;
  users: number;
};

const fallbackWorkspaces: WorkspaceSummary[] = [
  {
    name: "Osu Glow Studio",
    slug: "osu-glow-studio",
    category: "Hair, makeup, nails",
    plan: "Studio Pro",
    status: "Active",
  },
  {
    name: "Luxe Lash Lab",
    slug: "luxe-lash-lab",
    category: "Lashes and brows",
    plan: "Growth Suite",
    status: "Trial",
  },
];

const fallbackPlatformBusinesses: PlatformBusiness[] = [
  { name: "Osu Glow Studio", slug: "osu-glow-studio", plan: "Studio Pro", status: "Active", users: 6 },
  { name: "Luxe Lash Lab", slug: "luxe-lash-lab", plan: "Growth Suite", status: "Trial", users: 3 },
  { name: "Airport Spa Lounge", slug: "airport-spa-lounge", plan: "Enterprise", status: "Onboarding", users: 18 },
];

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function readableStatus(value: string) {
  return titleCase(value).replace("Trial", "Trial");
}

function fallbackWorkspacesForUser(user: AppUser): WorkspaceSummary[] {
  if (user.isPlatformAdmin) {
    return fallbackWorkspaces;
  }

  if (user.email === "owner@osuglow.example") {
    return fallbackWorkspaces.filter((workspace) => workspace.slug === "osu-glow-studio");
  }

  if (user.email === "owner@luxelash.example") {
    return fallbackWorkspaces.filter((workspace) => workspace.slug === "luxe-lash-lab");
  }

  return [];
}

export async function getWorkspaceSummaries(user: AppUser): Promise<WorkspaceSummary[]> {
  if (!isDatabaseConfigured()) {
    return fallbackWorkspacesForUser(user);
  }

  const businesses = user.isPlatformAdmin
    ? await prisma.business.findMany({
        orderBy: { createdAt: "asc" },
        include: {
          category: true,
          subscription: { include: { plan: true } },
        },
      })
    : (
        await prisma.staffMember.findMany({
          where: {
            userId: user.id,
            status: "ACTIVE",
          },
          orderBy: { createdAt: "asc" },
          include: {
            business: {
              include: {
                category: true,
                subscription: { include: { plan: true } },
              },
            },
          },
        })
      ).map((membership) => membership.business);

  return businesses.map((business) => ({
    name: business.name,
    slug: business.slug,
    category: business.category.label,
    plan: business.subscription?.plan.name ?? "No plan",
    status: readableStatus(business.status),
  }));
}

export async function getPlatformBusinesses(): Promise<PlatformBusiness[]> {
  if (!isDatabaseConfigured()) {
    return fallbackPlatformBusinesses;
  }

  const businesses = await prisma.business.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      subscription: { include: { plan: true } },
      _count: {
        select: {
          staff: true,
        },
      },
    },
  });

  return businesses.map((business) => ({
    name: business.name,
    slug: business.slug,
    plan: business.subscription?.plan.name ?? "No plan",
    status: readableStatus(business.status),
    users: business._count.staff,
  }));
}

export async function getPlatformStats() {
  if (!isDatabaseConfigured()) {
    return [
      { label: "Active businesses", value: "42", detail: "8 in trial" },
      { label: "Monthly recurring revenue", value: "GH₵ 38,600", detail: "+12% month over month" },
      { label: "Open support cases", value: "6", detail: "2 billing, 4 onboarding" },
      { label: "System health", value: "99.98%", detail: "Last 30 days" },
    ];
  }

  const [activeBusinesses, trialBusinesses, totalStaff] = await Promise.all([
    prisma.business.count({ where: { status: "ACTIVE" } }),
    prisma.business.count({ where: { status: "TRIAL" } }),
    prisma.staffMember.count({ where: { status: "ACTIVE" } }),
  ]);

  return [
    { label: "Active businesses", value: String(activeBusinesses), detail: `${trialBusinesses} in trial` },
    { label: "Staff seats", value: String(totalStaff), detail: "Active tenant users" },
    { label: "Open support cases", value: "0", detail: "Support module pending" },
    { label: "System health", value: "Ready", detail: "Database connected" },
  ];
}
