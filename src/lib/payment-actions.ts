"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  recordPayment,
  updatePaymentMeta,
  voidPayment,
  refundPayment,
  getPaymentDetail,
} from "@/lib/payment-data";
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
 * Audit for money movements. Unlike the other modules', this is NOT best-effort:
 * a refund or void must not proceed unless its audit row is written — that's the
 * whole point of "financial history is never rewritten silently". If the trail
 * can't be recorded, the caller is told and can retry.
 */
async function auditFinancial(
  businessSlug: string,
  user: AppUser,
  staffMemberId: string | null,
  action: string,
  entityId: string,
  metadata: Record<string, unknown>,
): Promise<boolean> {
  try {
    const business = await prisma.business.findUnique({ where: { slug: businessSlug }, select: { id: true } });
    if (!business) return false;
    await prisma.auditLog.create({
      data: { businessId: business.id, actorUserId: user.id, actorStaffId: staffMemberId, action, entityType: "payment", entityId, metadata: metadata as never },
    });
    return true;
  } catch {
    return false;
  }
}

export async function recordPaymentAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const returnTo = getString(formData, "returnTo");
  // Previously unguarded — anyone with tenant access could record a payment.
  const { allowed } = await authorize(businessSlug, "payments:record");
  if (!allowed) {
    redirect(`/${businessSlug}/payments?toastError=${encodeURIComponent("You don't have permission to record payments.")}`);
  }

  const result = await recordPayment({
    businessSlug,
    customer: getString(formData, "customer"),
    appointmentId: getString(formData, "appointmentId"),
    invoiceId: getString(formData, "invoiceId"),
    amount: parseMoney(getString(formData, "amount")),
    method: getString(formData, "method"),
    type: getString(formData, "type"),
    reference: getString(formData, "reference"),
  });
  if (!result.ok) {
    if (returnTo.startsWith(`/${businessSlug}/`)) {
      redirect(`${returnTo}?error=${encodeURIComponent(result.error)}`);
    }
    redirect(`/${businessSlug}/payments?toastError=${encodeURIComponent(result.error)}`);
  }

  revalidatePath(`/${businessSlug}/payments`);
  if (returnTo.startsWith(`/${businessSlug}/`)) {
    revalidatePath(returnTo);
    redirect(`${returnTo}?toast=${encodeURIComponent("Payment recorded")}`);
  }
  redirect(`/${businessSlug}/payments?toast=${encodeURIComponent("Payment recorded")}`);
}

export async function updatePaymentMetaAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const paymentId = getString(formData, "paymentId");
  const { user, membership, allowed } = await authorize(businessSlug, "payments:edit");
  const back = `/${businessSlug}/payments/${paymentId}`;
  if (!allowed) redirect(`${back}?error=${encodeURIComponent("You don't have permission to edit payments.")}`);

  const result = await updatePaymentMeta({
    businessSlug,
    paymentId,
    reference: getString(formData, "reference"),
    note: getString(formData, "note"),
    appointmentId: getString(formData, "appointmentId"),
  });
  if (!result.ok) redirect(`${back}?error=${encodeURIComponent(result.error)}`);

  // Metadata only — money didn't move — so a best-effort audit is fine here.
  await auditFinancial(businessSlug, user, membership?.staffMemberId ?? null, "payment.meta_updated", paymentId, {});
  revalidatePath(`/${businessSlug}/payments`);
  revalidatePath(back);
  redirect(`/${businessSlug}/payments?toast=${encodeURIComponent("Payment details updated")}`);
}

export async function voidPaymentAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const paymentId = getString(formData, "paymentId");
  const reason = getString(formData, "reason");
  const { user, membership, allowed } = await authorize(businessSlug, "payments:void");
  const back = `/${businessSlug}/payments/${paymentId}`;
  if (!allowed) redirect(`${back}?error=${encodeURIComponent("Only owners and managers can void payments.")}`);

  // Snapshot before the reversal so the trail captures what was undone.
  const before = await getPaymentDetail(businessSlug, paymentId);

  const result = await voidPayment(businessSlug, paymentId, reason);
  if (!result.ok) redirect(`${back}?error=${encodeURIComponent(result.error)}`);

  const recorded = await auditFinancial(businessSlug, user, membership?.staffMemberId ?? null, "payment.voided", paymentId, {
    amount: before?.amountRaw,
    method: before?.method,
    reason: reason.trim() || undefined,
  });
  if (!recorded) {
    redirect(`${back}?error=${encodeURIComponent("Couldn't record the audit trail — the void was not applied. Try again.")}`);
  }

  revalidatePath(`/${businessSlug}/payments`);
  revalidatePath(back);
  redirect(`/${businessSlug}/payments?toast=${encodeURIComponent("Payment voided")}`);
}

export async function refundPaymentAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const paymentId = getString(formData, "paymentId");
  const reason = getString(formData, "reason");
  const amount = parseMoney(getString(formData, "amount"));
  const { user, membership, allowed } = await authorize(businessSlug, "payments:refund");
  const back = `/${businessSlug}/payments/${paymentId}`;
  if (!allowed) redirect(`${back}?error=${encodeURIComponent("Only owners and managers can issue refunds.")}`);

  const result = await refundPayment(businessSlug, paymentId, amount, reason);
  if (!result.ok) redirect(`${back}?error=${encodeURIComponent(result.error)}`);

  const recorded = await auditFinancial(businessSlug, user, membership?.staffMemberId ?? null, "payment.refunded", paymentId, {
    amount,
    reason: reason.trim() || undefined,
  });
  if (!recorded) {
    // The offsetting REFUND row exists; flag that the trail failed so it can be
    // reconciled, rather than pretending nothing happened.
    redirect(`${back}?error=${encodeURIComponent("Refund issued but the audit entry failed to save — please note this manually.")}`);
  }

  revalidatePath(`/${businessSlug}/payments`);
  revalidatePath(back);
  redirect(`/${businessSlug}/payments?toast=${encodeURIComponent("Refund issued")}`);
}
