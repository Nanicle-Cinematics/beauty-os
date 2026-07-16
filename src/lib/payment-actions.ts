"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { recordPayment } from "@/lib/payment-data";
import { requireTenantAccess } from "@/lib/auth";

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

export async function recordPaymentAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  await requireTenantAccess(businessSlug);

  await recordPayment({
    businessSlug,
    customer: getString(formData, "customer"),
    appointmentId: getString(formData, "appointmentId"),
    amount: parseMoney(getString(formData, "amount")),
    method: getString(formData, "method"),
    type: getString(formData, "type"),
    reference: getString(formData, "reference"),
  });

  revalidatePath(`/${businessSlug}/payments`);
  redirect(`/${businessSlug}/payments?toast=${encodeURIComponent("Payment recorded")}`);
}
