import "server-only";

import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { withBypass } from "@/lib/tenant-context";
import type { AppUser } from "@/lib/auth";

export type WorkspaceSummary = {
  name: string;
  slug: string;
  category: string;
  plan: string;
  status: string;
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

export type TenantChrome = {
  name: string;
  slug: string;
  logoUrl: string | null;
  categoryKey: string;
  planName: string;
  status: string;
  isTrial: boolean;
  namePlaceholder: boolean;
  staffSeats: number;
  branchCount: number;
  account: { email: string; name: string; avatarUrl: string | null; themePreference: string; canSwitch: boolean; isAdmin: boolean };
};

// Lightweight data for the shared app shell (sidebar plan card + account footer).
// Reuses per-tenant fields already available; keeps the layout query cheap.
export async function getTenantChrome(user: AppUser, slug: string): Promise<TenantChrome | null> {
  if (!isDatabaseConfigured()) {
    const workspaces = fallbackWorkspacesForUser(user);
    const current = workspaces.find((workspace) => workspace.slug === slug);
    if (!current) {
      return null;
    }
    return {
      name: current.name,
      slug: current.slug,
      logoUrl: null,
      categoryKey: "hair_makeup_nails",
      planName: current.plan,
      status: current.status,
      isTrial: current.status.toLowerCase() === "trial",
      namePlaceholder: false,
      staffSeats: current.slug === "osu-glow-studio" ? 6 : 3,
      branchCount: 1,
      account: {
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        themePreference: user.themePreference,
        canSwitch: user.isPlatformAdmin,
        isAdmin: user.isPlatformAdmin,
      },
    };
  }

  const business = await prisma.business.findUnique({
    where: { slug },
    include: {
      category: true,
      subscription: { include: { plan: true } },
      _count: { select: { staff: true } },
    },
  });

  if (!business) {
    return null;
  }

  let canSwitch = user.isPlatformAdmin;
  if (!canSwitch) {
    // Counting the user's memberships spans all their businesses — a legitimate
    // cross-tenant read inside a tenant-scoped request, so lift RLS for it.
    const memberships = await withBypass(() =>
      prisma.staffMember.count({ where: { userId: user.id, status: "ACTIVE" } }),
    );
    canSwitch = memberships > 1;
  }

  return {
    name: business.name,
    slug: business.slug,
    logoUrl: business.logoUrl,
    categoryKey: business.category.key,
    planName: business.subscription?.plan.name ?? "No plan",
    status: readableStatus(business.status),
    isTrial: business.status === "TRIAL",
    namePlaceholder: business.namePlaceholder,
    staffSeats: business._count.staff,
    branchCount: 1,
    account: {
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      themePreference: user.themePreference,
      canSwitch,
      isAdmin: user.isPlatformAdmin,
    },
  };
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
