"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  addProduct,
  adjustStock,
  updateProduct,
  deleteProduct,
  getProductDetail,
} from "@/lib/inventory-data";
import { requireTenantAccess, type AppUser } from "@/lib/auth";
import { authorizeCapability, CAPABILITY_MODULE, type Capability } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

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
        entityType: "product",
        entityId,
        metadata: metadata as never,
      },
    });
  } catch {
    /* ignore */
  }
}

export async function addProductAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const { allowed } = await authorize(businessSlug, "inventory:edit");
  if (!allowed) {
    redirect(`/${businessSlug}/inventory?toastError=${encodeURIComponent("You don't have permission to add products.")}`);
  }

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
  const productId = getString(formData, "productId");
  const delta = parseNumber(getString(formData, "delta"));
  const { user, membership, allowed } = await authorize(businessSlug, "inventory:adjust");
  if (!allowed) {
    redirect(`/${businessSlug}/inventory?toastError=${encodeURIComponent("You don't have permission to adjust stock.")}`);
  }

  await adjustStock({
    businessSlug,
    productId,
    delta,
    note: getString(formData, "note"),
  });

  // adjustStock already writes a StockMovement; the audit trail records WHO
  // reached in, which the movement ledger alone doesn't capture.
  if (Number.isFinite(delta) && delta !== 0) {
    await audit(businessSlug, user, membership?.staffMemberId ?? null, "product.stock_adjusted", productId, {
      delta,
      note: getString(formData, "note") || undefined,
    });
  }

  revalidatePath(`/${businessSlug}/inventory`);
  revalidatePath(`/${businessSlug}/inventory/${productId}`);
  redirect(`/${businessSlug}/inventory?toast=${encodeURIComponent("Stock updated")}`);
}

export async function updateProductAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const productId = getString(formData, "productId");
  const { user, membership, allowed } = await authorize(businessSlug, "inventory:edit");

  const back = `/${businessSlug}/inventory/${productId}`;
  if (!allowed) {
    redirect(`${back}?error=${encodeURIComponent("You don't have permission to edit products.")}`);
  }

  const before = await getProductDetail(businessSlug, productId);
  const selling = parseNumber(getString(formData, "sellingPrice"));
  const reorder = parseNumber(getString(formData, "reorderThreshold"));

  const result = await updateProduct({
    businessSlug,
    productId,
    name: getString(formData, "name"),
    sku: getString(formData, "sku"),
    barcode: getString(formData, "barcode"),
    category: getString(formData, "category"),
    supplier: getString(formData, "supplier"),
    costPrice: parseNumber(getString(formData, "costPrice")),
    sellingPrice: Number.isFinite(selling) ? selling : null,
    reorderThreshold: Number.isFinite(reorder) ? reorder : null,
    expiryDate: parseDate(getString(formData, "expiryDate")),
  });

  if (!result.ok) {
    redirect(`${back}?error=${encodeURIComponent(result.error)}`);
  }

  const after = await getProductDetail(businessSlug, productId);
  if (before && after) {
    const derived = ["quantityOnHand", "movementCount", "currency"];
    const changed = (Object.keys(before) as (keyof typeof before)[]).filter(
      (k) => !derived.includes(k) && before[k] !== after[k],
    );
    if (changed.length) {
      await audit(businessSlug, user, membership?.staffMemberId ?? null, "product.updated", productId, {
        changed,
        ...(changed.includes("costPrice") ? { costPrice: { from: before.costPrice, to: after.costPrice } } : {}),
      });
    }
  }

  revalidatePath(`/${businessSlug}/inventory`);
  revalidatePath(back);
  redirect(`/${businessSlug}/inventory?toast=${encodeURIComponent("Product updated")}`);
}

export async function deleteProductAction(formData: FormData) {
  const businessSlug = safeBusinessSlug(getString(formData, "businessSlug"));
  const productId = getString(formData, "productId");
  const { user, membership, allowed } = await authorize(businessSlug, "inventory:delete");

  const back = `/${businessSlug}/inventory/${productId}`;
  if (!allowed) {
    redirect(`${back}?error=${encodeURIComponent("Only owners and managers can delete products.")}`);
  }

  const detail = await getProductDetail(businessSlug, productId);
  const result = await deleteProduct(businessSlug, productId);
  if (!result.ok) {
    redirect(`${back}?error=${encodeURIComponent(result.error)}`);
  }

  await audit(businessSlug, user, membership?.staffMemberId ?? null, "product.deleted", productId, {
    name: detail?.name,
  });

  revalidatePath(`/${businessSlug}/inventory`);
  redirect(`/${businessSlug}/inventory?toast=${encodeURIComponent("Product deleted")}`);
}
