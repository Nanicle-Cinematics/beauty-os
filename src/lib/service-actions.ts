"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createService,
  updateService,
  setServiceActive,
  deleteService,
  getServiceDetail,
} from "@/lib/service-data";
import { requireTenantAccess, type AppUser } from "@/lib/auth";
import { authorizeCapability, CAPABILITY_MODULE, type Capability } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function safeBusinessSlug(value: string) {
  return value.replace(/[^a-z0-9-]/g, "");
}

function parseMoney(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function parseWholeNumber(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function authorize(businessSlug: string, capability: Capability) {
  const user = await requireTenantAccess(businessSlug);
  const { membership, allowed, blockedByPlan } = await authorizeCapability(user, businessSlug, capability);
  // Blocked by the plan rather than the role: send them to the upgrade page.
  // Telling a manager they lack permission to do their own job would read as a
  // broken account, when the real answer is that the workspace never bought it.
  if (blockedByPlan) {
    redirect(`/${businessSlug}/upgrade?module=${CAPABILITY_MODULE[capability]}`);
  }
  return { user, membership, allowed, blockedByPlan };
}

/** Best-effort audit: losing the trail must never lose the edit. */
async function audit(
  businessSlug: string,
  user: AppUser,
  staffMemberId: string | null,
  action: string,
  entityId: string,
  metadata: Record<string, unknown>,
) {
  try {
    const business = await prisma.business.findUnique({ where: { slug: businessSlug }, select: { id: true } });
    if (!business) return;
    await prisma.auditLog.create({
      data: {
        businessId: business.id,
        actorUserId: user.id,
        actorStaffId: staffMemberId,
        action,
        entityType: "service",
        entityId,
        metadata: metadata as never,
      },
    });
  } catch {
    /* ignore */
  }
}

export async function createServiceAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const { allowed } = await authorize(businessSlug, "services:edit");
  if (!allowed) {
    redirect(`/${businessSlug}/services?toastError=${encodeURIComponent("Only owners and managers can add services.")}`);
  }


  await createService({
    businessSlug,
    name: getString(formData, "name"),
    description: getString(formData, "description"),
    price: parseMoney(getString(formData, "price")),
    durationMinutes: parseWholeNumber(getString(formData, "durationMinutes")),
    colorHex: getString(formData, "colorHex"),
    categoryId: getString(formData, "categoryId"),
    newCategoryName: getString(formData, "newCategoryName"),
    staffIds: formData.getAll("staffIds").map((value) => String(value)),
  });

  revalidatePath(`/${businessSlug}/services`);
  redirect(`/${businessSlug}/services?toast=${encodeURIComponent("Service added")}`);
}

export async function updateServiceAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const serviceId = getString(formData, "serviceId");
  const { user, membership, allowed } = await authorize(businessSlug, "services:edit");

  const back = `/${businessSlug}/services/${serviceId}`;
  if (!allowed) {
    redirect(`${back}?error=${encodeURIComponent("Only owners and managers can change services.")}`);
  }

  const before = await getServiceDetail(businessSlug, serviceId);

  const result = await updateService({
    businessSlug,
    serviceId,
    name: getString(formData, "name"),
    description: getString(formData, "description"),
    price: parseMoney(getString(formData, "price")),
    durationMinutes: parseWholeNumber(getString(formData, "durationMinutes")),
    colorHex: getString(formData, "colorHex"),
    categoryId: getString(formData, "categoryId"),
    newCategoryName: getString(formData, "newCategoryName"),
    prepInstructions: getString(formData, "prepInstructions"),
    cancellationPolicy: getString(formData, "cancellationPolicy"),
    staffIds: formData.getAll("staffIds").map((value) => String(value)),
  });

  if (!result.ok) {
    redirect(`${back}?error=${encodeURIComponent(result.error)}`);
  }

  const after = await getServiceDetail(businessSlug, serviceId);
  if (before && after) {
    const derived = ["bookingCount", "currency", "isActive"];
    const changed = (Object.keys(before) as (keyof typeof before)[]).filter((k) => {
      if (derived.includes(k)) return false;
      const a = before[k];
      const b = after[k];
      return Array.isArray(a) && Array.isArray(b) ? a.join() !== b.join() : a !== b;
    });
    if (changed.length) {
      await audit(businessSlug, user, membership?.staffMemberId ?? null, "service.updated", serviceId, {
        changed,
        // Price moves are the ones anyone will want to reconstruct later.
        ...(changed.includes("price") ? { price: { from: before.price, to: after.price } } : {}),
      });
    }
  }

  revalidatePath(`/${businessSlug}/services`);
  revalidatePath(back);
  redirect(`/${businessSlug}/services?toast=${encodeURIComponent("Service updated")}`);
}

export async function setServiceActiveAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const serviceId = getString(formData, "serviceId");
  const isActive = getString(formData, "isActive") === "true";
  const { user, membership, allowed } = await authorize(businessSlug, "services:retire");

  const back = `/${businessSlug}/services/${serviceId}`;
  if (!allowed) {
    redirect(`${back}?error=${encodeURIComponent("Only owners and managers can retire services.")}`);
  }

  const result = await setServiceActive(businessSlug, serviceId, isActive);
  if (!result.ok) {
    redirect(`${back}?error=${encodeURIComponent(result.error)}`);
  }

  await audit(
    businessSlug,
    user,
    membership?.staffMemberId ?? null,
    isActive ? "service.restored" : "service.retired",
    serviceId,
    {},
  );

  revalidatePath(`/${businessSlug}/services`);
  revalidatePath(back);
  redirect(`/${businessSlug}/services?toast=${encodeURIComponent(isActive ? "Service restored" : "Service retired")}`);
}

/** The list's inline toggle. */
export async function toggleServiceActiveAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const serviceId = getString(formData, "serviceId");
  const { user, membership, allowed } = await authorize(businessSlug, "services:retire");
  if (!allowed) {
    redirect(`/${businessSlug}/services?toastError=${encodeURIComponent("Only owners and managers can retire services.")}`);
  }

  const current = await getServiceDetail(businessSlug, serviceId);
  if (!current) {
    redirect(`/${businessSlug}/services?toastError=${encodeURIComponent("That service no longer exists.")}`);
  }

  const next = !current.isActive;
  await setServiceActive(businessSlug, serviceId, next);
  await audit(
    businessSlug,
    user,
    membership?.staffMemberId ?? null,
    next ? "service.restored" : "service.retired",
    serviceId,
    {},
  );

  revalidatePath(`/${businessSlug}/services`);
  redirect(`/${businessSlug}/services?toast=${encodeURIComponent(next ? "Service restored" : "Service retired")}`);
}

export async function deleteServiceAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const serviceId = getString(formData, "serviceId");
  const { user, membership, allowed } = await authorize(businessSlug, "services:delete");

  const back = `/${businessSlug}/services/${serviceId}`;
  if (!allowed) {
    redirect(`${back}?error=${encodeURIComponent("Only owners and managers can delete services.")}`);
  }

  const detail = await getServiceDetail(businessSlug, serviceId);
  const result = await deleteService(businessSlug, serviceId);
  if (!result.ok) {
    redirect(`${back}?error=${encodeURIComponent(result.error)}`);
  }

  await audit(businessSlug, user, membership?.staffMemberId ?? null, "service.deleted", serviceId, {
    name: detail?.name,
  });

  revalidatePath(`/${businessSlug}/services`);
  redirect(`/${businessSlug}/services?toast=${encodeURIComponent("Service deleted")}`);
}
