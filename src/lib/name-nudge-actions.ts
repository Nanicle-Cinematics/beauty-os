"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/auth";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

// Only an owner/manager of the current tenant may rename it or dismiss the nudge.
// requireTenantAccess has already scoped RLS to this business, so the membership
// lookup is naturally limited to the current tenant.
async function isManager(userId: string) {
  const membership = await prisma.staffMember.findFirst({
    where: { userId, status: "ACTIVE", role: { in: ["OWNER", "MANAGER"] } },
    select: { id: true },
  });
  return Boolean(membership);
}

export async function renameBusinessAction(formData: FormData) {
  const slug = getString(formData, "slug");
  const user = await requireTenantAccess(slug);
  if (!(await isManager(user.id))) {
    redirect(`/${slug}`);
  }

  const name = getString(formData, "name").trim();
  // Too short → leave the placeholder flag set so the nudge stays visible.
  if (name.length >= 2) {
    await prisma.business.update({ where: { slug }, data: { name, namePlaceholder: false } });
  }
  redirect(`/${slug}`);
}

export async function dismissNameNudgeAction(formData: FormData) {
  const slug = getString(formData, "slug");
  const user = await requireTenantAccess(slug);
  if (!(await isManager(user.id))) {
    redirect(`/${slug}`);
  }
  // Keep the current name, just stop nudging.
  await prisma.business.update({ where: { slug }, data: { namePlaceholder: false } });
  redirect(`/${slug}`);
}
