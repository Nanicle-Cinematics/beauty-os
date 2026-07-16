"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAppointment, updateAppointmentStatus } from "@/lib/appointment-data";
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

  await createAppointment({
    businessSlug,
    customer: getString(formData, "customer"),
    service: getString(formData, "service"),
    staffMemberId: getString(formData, "staffMemberId"),
    startAt: new Date(getString(formData, "startAt")),
    price: Number.isFinite(parsedPrice) ? parsedPrice : null,
  });

  revalidatePath(`/${businessSlug}/appointments`);
  redirect(`/${businessSlug}/appointments?toast=${encodeURIComponent("Booking created")}`);
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
