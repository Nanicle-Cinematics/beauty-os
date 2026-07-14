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

