"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { addProduct, adjustStock } from "@/lib/inventory-data";
import { requireTenantAccess } from "@/lib/auth";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function safeBusinessSlug(value: string) {
  return value.replace(/[^a-z0-9-]/g, "");
}

function parseNumber(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function parseDate(value: string) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function addProductAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  await requireTenantAccess(businessSlug);

  const selling = parseNumber(getString(formData, "sellingPrice"));
  const reorder = parseNumber(getString(formData, "reorderThreshold"));
  const opening = parseNumber(getString(formData, "quantityOnHand"));

  await addProduct({
    businessSlug,
    name: getString(formData, "name"),
    category: getString(formData, "category"),
    supplier: getString(formData, "supplier"),
    costPrice: parseNumber(getString(formData, "costPrice")),
    sellingPrice: Number.isFinite(selling) ? selling : null,
    quantityOnHand: Number.isFinite(opening) ? opening : 0,
    reorderThreshold: Number.isFinite(reorder) ? reorder : null,
    expiryDate: parseDate(getString(formData, "expiryDate")),
    barcode: getString(formData, "barcode"),
  });

  revalidatePath(`/${businessSlug}/inventory`);
  redirect(`/${businessSlug}/inventory?toast=${encodeURIComponent("Product added")}`);
}

export async function adjustStockAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  await requireTenantAccess(businessSlug);

  await adjustStock({
    businessSlug,
    productId: getString(formData, "productId"),
    delta: parseNumber(getString(formData, "delta")),
    note: getString(formData, "note"),
  });

  revalidatePath(`/${businessSlug}/inventory`);
  redirect(`/${businessSlug}/inventory?toast=${encodeURIComponent("Stock updated")}`);
}
