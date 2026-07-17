"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAppointment, updateAppointmentStatus, firmHold, releaseHold } from "@/lib/appointment-data";
import { requireTenantAccess } from "@/lib/auth";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function safeBusinessSlug(value: string) {
  return value.replace(/[^a-z0-9-]/g, "");
}

export async function createAppointmentAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  await requireTenantAccess(businessSlug);

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
  await requireTenantAccess(businessSlug);

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
  await requireTenantAccess(businessSlug);

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
  await requireTenantAccess(businessSlug);

  await updateAppointmentStatus({
    businessSlug,
    appointmentId: getString(formData, "appointmentId"),
    status: getString(formData, "status") as "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW",
  });

  revalidatePath(`/${businessSlug}/appointments`);
  redirect(`/${businessSlug}/appointments?toast=${encodeURIComponent("Appointment updated")}`);
}
