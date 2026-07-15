"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createExpense, updateExpense, deleteExpense } from "@/lib/finance-data";
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

export async function createExpenseAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  await requireTenantAccess(businessSlug);

  const result = await createExpense({
    businessSlug,
    category: getString(formData, "category"),
    amount: parseMoney(getString(formData, "amount")),
    description: getString(formData, "description"),
    incurredAt: getString(formData, "incurredAt"),
  });

  revalidatePath(`/${businessSlug}/finance`);

  if (!result.ok) {
    redirect(`/${businessSlug}/finance?error=${encodeURIComponent(result.error)}`);
  }
  redirect(`/${businessSlug}/finance?logged=1`);
}

export async function updateExpenseAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  await requireTenantAccess(businessSlug);
  const id = getString(formData, "expenseId");

  const result = await updateExpense({
    businessSlug,
    id,
    category: getString(formData, "category"),
    amount: parseMoney(getString(formData, "amount")),
    description: getString(formData, "description"),
    incurredAt: getString(formData, "incurredAt"),
  });

  revalidatePath(`/${businessSlug}/finance`);
  revalidatePath(`/${businessSlug}/finance/expenses`);

  if (!result.ok) {
    redirect(`/${businessSlug}/finance/expenses/${id}/edit?error=${encodeURIComponent(result.error)}`);
  }
  redirect(`/${businessSlug}/finance/expenses?updated=1`);
}

export async function deleteExpenseAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  await requireTenantAccess(businessSlug);
  const id = getString(formData, "expenseId");

  await deleteExpense(businessSlug, id);

  revalidatePath(`/${businessSlug}/finance`);
  revalidatePath(`/${businessSlug}/finance/expenses`);
  redirect(`/${businessSlug}/finance/expenses?removed=1`);
}
