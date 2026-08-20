"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createClient,
  updateClient,
  setClientArchived,
  deleteClient,
  getClientDetail,
} from "@/lib/client-data";
import { requireTenantAccess, type AppUser } from "@/lib/auth";
import { authorizeCapability, CAPABILITY_MODULE, type Capability } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function getBool(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function safeBusinessSlug(value: string) {
  return value.replace(/[^a-z0-9-]/g, "");
}

function parseTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function parseDate(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Authorize against the caller's role IN THIS BUSINESS, then hand back the
 * membership so the audit trail can record who acted. The UI hides what you
 * can't do, but hiding a button is not a permission check — this is.
 */
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

/**
 * Records who changed what, and when. Best-effort: an audit write failing must
 * never cost someone their edit.
 */
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
        entityType: "customer",
        entityId,
        metadata: metadata as never,
      },
    });
  } catch {
    /* losing the trail must not lose the edit */
  }
}

export async function createClientAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const { allowed } = await authorize(businessSlug, "clients:edit");
  if (!allowed) {
    redirect(`/${businessSlug}/clients?toastError=${encodeURIComponent("You don't have permission to add clients.")}`);
  }

  await createClient({
    businessSlug,
    firstName: getString(formData, "firstName"),
    lastName: getString(formData, "lastName"),
    phone: getString(formData, "phone"),
    email: getString(formData, "email"),
    city: getString(formData, "city"),
    birthdate: parseDate(getString(formData, "birthdate")),
    tags: parseTags(getString(formData, "tags")),
    skinNotes: getString(formData, "skinNotes"),
    allergies: getString(formData, "allergies"),
  });

  revalidatePath(`/${businessSlug}/clients`);
  redirect(`/${businessSlug}/clients?toast=${encodeURIComponent("Client added")}`);
}

export async function updateClientAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const clientId = getString(formData, "clientId");
  const { user, membership, allowed } = await authorize(businessSlug, "clients:edit");

  const back = `/${businessSlug}/clients/${clientId}`;
  if (!allowed) {
    redirect(`${back}?error=${encodeURIComponent("You don't have permission to edit clients.")}`);
  }

  // Snapshot before the write so the trail can say what actually changed rather
  // than just "someone edited this".
  const before = await getClientDetail(businessSlug, clientId);

  const result = await updateClient({
    businessSlug,
    clientId,
    firstName: getString(formData, "firstName"),
    lastName: getString(formData, "lastName"),
    phone: getString(formData, "phone"),
    email: getString(formData, "email"),
    addressLine1: getString(formData, "addressLine1"),
    city: getString(formData, "city"),
    birthdate: parseDate(getString(formData, "birthdate")),
    anniversaryDate: parseDate(getString(formData, "anniversaryDate")),
    tags: parseTags(getString(formData, "tags")),
    skinNotes: getString(formData, "skinNotes"),
    allergies: getString(formData, "allergies"),
    marketingOptInEmail: getBool(formData, "marketingOptInEmail"),
    marketingOptInSms: getBool(formData, "marketingOptInSms"),
    marketingOptInWhatsapp: getBool(formData, "marketingOptInWhatsapp"),
    favoriteServiceId: getString(formData, "favoriteServiceId"),
    favoriteStaffId: getString(formData, "favoriteStaffId"),
  });

  if (!result.ok) {
    redirect(`${back}?error=${encodeURIComponent(result.error)}`);
  }

  const after = await getClientDetail(businessSlug, clientId);
  if (before && after) {
    const derived = ["historyCount", "appointmentCount", "paymentCount", "lifetimeSpend", "outstanding"];
    const changed = (Object.keys(before) as (keyof typeof before)[]).filter(
      (k) => !derived.includes(k) && before[k] !== after[k],
    );
    if (changed.length) {
      await audit(businessSlug, user, membership?.staffMemberId ?? null, "client.updated", clientId, {
        changed,
        // Consent changes are the ones worth being able to prove later.
        ...(changed.some((c) => String(c).startsWith("marketingOptIn"))
          ? {
              marketing: {
                email: after.marketingOptInEmail,
                sms: after.marketingOptInSms,
                whatsapp: after.marketingOptInWhatsapp,
              },
            }
          : {}),
      });
    }
  }

  revalidatePath(`/${businessSlug}/clients`);
  revalidatePath(back);
  redirect(`/${businessSlug}/clients?toast=${encodeURIComponent("Client updated")}`);
}

export async function setClientArchivedAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const clientId = getString(formData, "clientId");
  const archived = getString(formData, "archived") === "true";
  const { user, membership, allowed } = await authorize(businessSlug, "clients:archive");

  const back = `/${businessSlug}/clients/${clientId}`;
  if (!allowed) {
    redirect(`${back}?error=${encodeURIComponent("Only owners and managers can archive clients.")}`);
  }

  const result = await setClientArchived(businessSlug, clientId, archived);
  if (!result.ok) {
    redirect(`${back}?error=${encodeURIComponent(result.error)}`);
  }

  await audit(
    businessSlug,
    user,
    membership?.staffMemberId ?? null,
    archived ? "client.archived" : "client.restored",
    clientId,
    {},
  );

  revalidatePath(`/${businessSlug}/clients`);
  revalidatePath(back);
  redirect(`/${businessSlug}/clients?toast=${encodeURIComponent(archived ? "Client archived" : "Client restored")}`);
}

export async function deleteClientAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const clientId = getString(formData, "clientId");
  const { user, membership, allowed } = await authorize(businessSlug, "clients:delete");

  const back = `/${businessSlug}/clients/${clientId}`;
  if (!allowed) {
    redirect(`${back}?error=${encodeURIComponent("Only owners and managers can delete clients.")}`);
  }

  const detail = await getClientDetail(businessSlug, clientId);
  const result = await deleteClient(businessSlug, clientId);
  if (!result.ok) {
    redirect(`${back}?error=${encodeURIComponent(result.error)}`);
  }

  await audit(businessSlug, user, membership?.staffMemberId ?? null, "client.deleted", clientId, {
    name: detail ? `${detail.firstName} ${detail.lastName}`.trim() : undefined,
  });

  revalidatePath(`/${businessSlug}/clients`);
  redirect(`/${businessSlug}/clients?toast=${encodeURIComponent("Client deleted")}`);
}
