"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireTenantAccess, type AppUser } from "@/lib/auth";
import { membershipIn, roleCan, type Capability } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  createInvoice,
  createInvoiceFromAppointment,
  sendInvoice,
  voidInvoice,
} from "@/lib/invoice-data";

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

function parseDate(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function authorize(businessSlug: string, capability: Capability) {
  const user = await requireTenantAccess(businessSlug);
  const membership = await membershipIn(user, businessSlug);
  return { user, membership, allowed: roleCan(membership?.role, capability) };
}

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
      data: { businessId: business.id, actorUserId: user.id, actorStaffId: staffMemberId, action, entityType: "invoice", entityId, metadata: metadata as never },
    });
  } catch {
    // Invoice edits are reversible except payment movement, which stays in payment actions.
  }
}

export async function createInvoiceAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const { user, membership, allowed } = await authorize(businessSlug, "invoices:edit");
  if (!allowed) redirect(`/${businessSlug}/invoices/new?error=${encodeURIComponent("You don't have permission to create invoices.")}`);

  const appointmentId = getString(formData, "appointmentId");
  const result = await createInvoice({
    businessSlug,
    customer: getString(formData, "customer"),
    appointmentId,
    invoiceNumber: getString(formData, "invoiceNumber"),
    dueDate: parseDate(getString(formData, "dueDate")),
    description: getString(formData, "description"),
    quantity: parseMoney(getString(formData, "quantity")),
    unitPrice: parseMoney(getString(formData, "unitPrice")),
    discount: parseMoney(getString(formData, "discount")) || 0,
    tax: parseMoney(getString(formData, "tax")) || 0,
    notes: getString(formData, "notes"),
    terms: getString(formData, "terms"),
  });

  if (!result.ok || !result.id) redirect(`/${businessSlug}/invoices/new?error=${encodeURIComponent(result.ok ? "Invoice was not created." : result.error)}`);
  await audit(businessSlug, user, membership?.staffMemberId ?? null, "invoice.created", result.id, { appointmentId: appointmentId || undefined });
  revalidatePath(`/${businessSlug}/invoices`);
  redirect(`/${businessSlug}/invoices/${result.id}?toast=${encodeURIComponent("Invoice created")}`);
}

export async function createInvoiceFromAppointmentAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const appointmentId = getString(formData, "appointmentId");
  const { user, membership, allowed } = await authorize(businessSlug, "invoices:edit");
  const back = `/${businessSlug}/appointments/${appointmentId}`;
  if (!allowed) redirect(`${back}?error=${encodeURIComponent("You don't have permission to create invoices.")}`);

  const result = await createInvoiceFromAppointment(businessSlug, appointmentId);
  if (!result.ok || !result.id) redirect(`${back}?error=${encodeURIComponent(result.ok ? "Invoice was not created." : result.error)}`);

  await audit(businessSlug, user, membership?.staffMemberId ?? null, "invoice.created_from_appointment", result.id, { appointmentId });
  revalidatePath(`/${businessSlug}/appointments/${appointmentId}`);
  revalidatePath(`/${businessSlug}/invoices`);
  redirect(`/${businessSlug}/invoices/${result.id}?toast=${encodeURIComponent("Invoice created")}`);
}

export async function sendInvoiceAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const invoiceId = getString(formData, "invoiceId");
  const { user, membership, allowed } = await authorize(businessSlug, "invoices:send");
  const back = `/${businessSlug}/invoices/${invoiceId}`;
  if (!allowed) redirect(`${back}?error=${encodeURIComponent("You don't have permission to send invoices.")}`);

  const result = await sendInvoice(businessSlug, invoiceId);
  if (!result.ok) redirect(`${back}?error=${encodeURIComponent(result.error)}`);

  await audit(businessSlug, user, membership?.staffMemberId ?? null, "invoice.sent", invoiceId, {});
  revalidatePath(back);
  revalidatePath(`/${businessSlug}/invoices`);
  redirect(`${back}?toast=${encodeURIComponent("Invoice marked sent")}`);
}

export async function voidInvoiceAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const invoiceId = getString(formData, "invoiceId");
  const { user, membership, allowed } = await authorize(businessSlug, "invoices:void");
  const back = `/${businessSlug}/invoices/${invoiceId}`;
  if (!allowed) redirect(`${back}?error=${encodeURIComponent("Only owners and managers can void invoices.")}`);

  const result = await voidInvoice(businessSlug, invoiceId);
  if (!result.ok) redirect(`${back}?error=${encodeURIComponent(result.error)}`);

  await audit(businessSlug, user, membership?.staffMemberId ?? null, "invoice.voided", invoiceId, {});
  revalidatePath(back);
  revalidatePath(`/${businessSlug}/invoices`);
  redirect(`/${businessSlug}/invoices?toast=${encodeURIComponent("Invoice voided")}`);
}
