"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createAppointment,
  updateAppointmentStatus,
  updateAppointment,
  deleteAppointment,
  getAppointmentDetail,
  firmHold,
  releaseHold,
} from "@/lib/appointment-data";
import { requireTenantAccess, type AppUser } from "@/lib/auth";
import { membershipIn, roleCan, type Capability } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function safeBusinessSlug(value: string) {
  return value.replace(/[^a-z0-9-]/g, "");
}

async function authorize(businessSlug: string, capability: Capability) {
  const user = await requireTenantAccess(businessSlug);
  const membership = await membershipIn(user, businessSlug);
  return { user, membership, allowed: roleCan(membership?.role, capability) };
}

/** Best-effort audit: losing the trail must never lose the change. */
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
        entityType: "appointment",
        entityId,
        metadata: metadata as never,
      },
    });
  } catch {
    /* ignore */
  }
}

export async function createAppointmentAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const { allowed } = await authorize(businessSlug, "appointments:edit");
  if (!allowed) {
    redirect(`/${businessSlug}/appointments?toastError=${encodeURIComponent("You don't have permission to create bookings.")}`);
  }

  const parsedPrice = Number.parseFloat(getString(formData, "price"));
  const hold = getString(formData, "hold") === "on";
  const rawExpiry = getString(formData, "holdExpiresAt");
  const parsedExpiry = rawExpiry ? new Date(rawExpiry) : null;

  await createAppointment({
    businessSlug,
    customer: getString(formData, "customer"),
    service: getString(formData, "service"),
    staffMemberId: getString(formData, "staffMemberId"),
    startAt: new Date(getString(formData, "startAt")),
    price: Number.isFinite(parsedPrice) ? parsedPrice : null,
    hold,
    holdExpiresAt: parsedExpiry && !Number.isNaN(parsedExpiry.getTime()) ? parsedExpiry : null,
  });

  revalidatePath(`/${businessSlug}/appointments`);
  redirect(
    `/${businessSlug}/appointments?toast=${encodeURIComponent(hold ? "Date held" : "Booking created")}`,
  );
}

export async function firmHoldAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const { allowed } = await authorize(businessSlug, "appointments:edit");
  if (!allowed) {
    redirect(`/${businessSlug}/appointments?toastError=${encodeURIComponent("You don't have permission to change bookings.")}`);
  }

  const result = await firmHold({
    businessSlug,
    appointmentId: getString(formData, "appointmentId"),
  });

  revalidatePath(`/${businessSlug}/appointments`);

  if (!result.ok) {
    redirect(`/${businessSlug}/appointments?toastError=${encodeURIComponent(result.error)}`);
  }

  // Confirming can bump rival holds and email those clients, so say so rather
  // than letting it happen invisibly.
  const bumped = result.releasedCount ?? 0;
  const message = bumped
    ? `Hold confirmed — ${bumped} other ${bumped === 1 ? "hold" : "holds"} released and notified`
    : "Hold confirmed — it's a booking now";

  redirect(`/${businessSlug}/appointments?toast=${encodeURIComponent(message)}`);
}

export async function releaseHoldAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const { allowed } = await authorize(businessSlug, "appointments:edit");
  if (!allowed) {
    redirect(`/${businessSlug}/appointments?toastError=${encodeURIComponent("You don't have permission to change bookings.")}`);
  }

  const result = await releaseHold({
    businessSlug,
    appointmentId: getString(formData, "appointmentId"),
  });

  revalidatePath(`/${businessSlug}/appointments`);

  if (!result.ok) {
    redirect(`/${businessSlug}/appointments?toastError=${encodeURIComponent(result.error)}`);
  }

  const message = result.promotedName
    ? `Hold released — ${result.promotedName} is now first in line and has been told`
    : "Hold released — the slot is free";

  redirect(`/${businessSlug}/appointments?toast=${encodeURIComponent(message)}`);
}

export async function updateAppointmentStatusAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const appointmentId = getString(formData, "appointmentId");
  const status = getString(formData, "status") as "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  // This previously had no permission check at all — anyone with tenant access
  // could cancel or no-show a booking.
  const { user, membership, allowed } = await authorize(businessSlug, "appointments:edit");
  if (!allowed) {
    redirect(`/${businessSlug}/appointments?toastError=${encodeURIComponent("You don't have permission to change bookings.")}`);
  }

  await updateAppointmentStatus({ businessSlug, appointmentId, status });

  await audit(businessSlug, user, membership?.staffMemberId ?? null, "appointment.status_changed", appointmentId, { to: status });

  revalidatePath(`/${businessSlug}/appointments`);
  redirect(`/${businessSlug}/appointments?toast=${encodeURIComponent("Appointment updated")}`);
}

export async function updateAppointmentAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const appointmentId = getString(formData, "appointmentId");
  const { user, membership, allowed } = await authorize(businessSlug, "appointments:edit");

  const back = `/${businessSlug}/appointments/${appointmentId}`;
  if (!allowed) {
    redirect(`${back}?error=${encodeURIComponent("You don't have permission to edit bookings.")}`);
  }

  const before = await getAppointmentDetail(businessSlug, appointmentId);
  const parsedPrice = Number.parseFloat(getString(formData, "price"));

  const result = await updateAppointment({
    businessSlug,
    appointmentId,
    customer: getString(formData, "customer"),
    service: getString(formData, "service"),
    staffMemberId: getString(formData, "staffMemberId"),
    startAtLocal: getString(formData, "startAtLocal"),
    price: Number.isFinite(parsedPrice) ? parsedPrice : null,
    notes: getString(formData, "notes"),
  });

  if (!result.ok) {
    redirect(`${back}?error=${encodeURIComponent(result.error)}`);
  }

  const after = await getAppointmentDetail(businessSlug, appointmentId);
  if (before && after) {
    const derived = ["paymentCount", "collected", "outstanding", "currency", "isHold", "id"];
    const changed = (Object.keys(before) as (keyof typeof before)[]).filter(
      (k) => !derived.includes(k) && before[k] !== after[k],
    );
    if (changed.length) {
      await audit(businessSlug, user, membership?.staffMemberId ?? null, "appointment.updated", appointmentId, {
        changed,
        ...(changed.includes("startAtLocal") ? { rescheduled: { from: before.startAtLocal, to: after.startAtLocal } } : {}),
        ...(changed.includes("price") ? { price: { from: before.price, to: after.price } } : {}),
      });
    }
  }

  revalidatePath(`/${businessSlug}/appointments`);
  revalidatePath(`/${businessSlug}/calendar`);
  revalidatePath(back);
  redirect(`/${businessSlug}/appointments?toast=${encodeURIComponent("Booking updated")}`);
}

export async function deleteAppointmentAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const appointmentId = getString(formData, "appointmentId");
  const { user, membership, allowed } = await authorize(businessSlug, "appointments:delete");

  const back = `/${businessSlug}/appointments/${appointmentId}`;
  if (!allowed) {
    redirect(`${back}?error=${encodeURIComponent("Only owners and managers can delete bookings.")}`);
  }

  const result = await deleteAppointment(businessSlug, appointmentId);
  if (!result.ok) {
    redirect(`${back}?error=${encodeURIComponent(result.error)}`);
  }

  await audit(businessSlug, user, membership?.staffMemberId ?? null, "appointment.deleted", appointmentId, {});

  revalidatePath(`/${businessSlug}/appointments`);
  revalidatePath(`/${businessSlug}/calendar`);
  redirect(`/${businessSlug}/appointments?toast=${encodeURIComponent("Booking deleted")}`);
}
