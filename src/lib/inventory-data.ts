import "server-only";

import { prisma, tenantTransaction, isDatabaseConfigured } from "@/lib/prisma";
import { findOrCreateSupplier } from "@/lib/entity-resolve";

export type ProductStatus = "OK" | "LOW" | "OUT" | "EXPIRING" | "EXPIRED";

export type ProductRow = {
  id: string;
  name: string;
  category: string;
  supplier: string;
  stockLabel: string;
  level: number;
  status: ProductStatus;
  statusLabel: string;
  value: string;
  expiry: string;
};

export type MovementRow = {
  id: string;
  product: string;
  type: string;
  quantity: string;
  when: string;
};

export type InventoryStat = { label: string; value: string; detail: string };
export type SupplierOption = { id: string; label: string };

/**
 * Every editable ATTRIBUTE of a product. Quantity is deliberately absent — stock
 * only ever changes through a tracked StockMovement (adjustStock), never by
 * editing a number, so the ledger can't drift from reality.
 */
export type ProductDetail = {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  supplier: string;
  costPrice: string;
  sellingPrice: string;
  reorderThreshold: string;
  expiryDate: string;
  quantityOnHand: string;
  movementCount: number;
  currency: string;
};

export type InventoryWriteResult = { ok: true } | { ok: false; error: string };

export type InventoryModuleData = {
  tenant: { id: string; name: string; slug: string; currency: string; categoryKey: string };
  stats: InventoryStat[];
  products: ProductRow[];
  suppliers: SupplierOption[];
  movements: MovementRow[];
};

const EXPIRY_WINDOW_DAYS = 30;

const MOVEMENT_LABELS: Record<string, string> = {
  PURCHASE_IN: "Restock",
  SALE_OUT: "Sale",
  SERVICE_USAGE: "Service use",
  ADJUSTMENT: "Adjustment",
  EXPIRY_WRITE_OFF: "Write-off",
};

function currencySymbol(currency: string) {
  return currency === "GHS" ? "GH₵" : currency;
}

function money(amount: number, currency: string) {
  return `${currencySymbol(currency)} ${Math.round(amount).toLocaleString("en-US")}`;
}

function formatQty(qty: number) {
  return qty % 1 === 0 ? String(qty) : qty.toFixed(1);
}

function shortDate(date: Date | null) {
  if (!date) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }).format(date);
}

function classify(qty: number, threshold: number | null, expiry: Date | null, now: Date): { status: ProductStatus; label: string } {
  if (expiry && expiry.getTime() < now.getTime()) {
    return { status: "EXPIRED", label: "Expired" };
  }
  if (qty <= 0) {
    return { status: "OUT", label: "Out of stock" };
  }
  if (expiry) {
    const days = (expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
    if (days <= EXPIRY_WINDOW_DAYS) {
      return { status: "EXPIRING", label: "Expiring" };
    }
  }
  if (threshold != null && qty <= threshold) {
    return { status: "LOW", label: "Low" };
  }
  return { status: "OK", label: "In stock" };
}

export async function getInventoryModuleData(businessSlug: string): Promise<InventoryModuleData | null> {
  // No demo fallback — inventing stock when the database is unreachable would
  // show a studio products it doesn't hold. Caller 404s instead.
  if (!isDatabaseConfigured()) {
    return null;
  }

  const business = await prisma.business.findUnique({
    where: { slug: businessSlug },
    select: { id: true, name: true, slug: true, currency: true, category: { select: { key: true } } },
  });

  if (!business) {
    return null;
  }

  const [products, suppliers, movements] = await Promise.all([
    prisma.product.findMany({
      where: { businessId: business.id },
      orderBy: { name: "asc" },
      include: { supplier: true },
    }),
    prisma.supplier.findMany({
      where: { businessId: business.id },
      orderBy: { name: "asc" },
    }),
    prisma.stockMovement.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { product: true },
    }),
  ]);

  const currency = business.currency;
  const now = new Date();

  const productRows: ProductRow[] = products.map((product) => {
    const qty = Number(product.quantityOnHand);
    const threshold = product.reorderThreshold != null ? Number(product.reorderThreshold) : null;
    const { status, label } = classify(qty, threshold, product.expiryDate, now);
    const denominator = threshold && threshold > 0 ? threshold * 2 : qty || 1;
    return {
      id: product.id,
      name: product.name,
      category: product.category ?? "Uncategorised",
      supplier: product.supplier?.name ?? "—",
      stockLabel: `${formatQty(qty)} in stock`,
      level: Math.max(0, Math.min(100, Math.round((qty / denominator) * 100))),
      status,
      statusLabel: label,
      value: money(qty * Number(product.costPrice), currency),
      expiry: shortDate(product.expiryDate),
    };
  });

  const lowStock = products.filter(
    (product) => product.reorderThreshold != null && Number(product.quantityOnHand) <= Number(product.reorderThreshold),
  ).length;
  const expiringSoon = products.filter((product) => {
    if (!product.expiryDate) {
      return false;
    }
    const days = (product.expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
    return days <= EXPIRY_WINDOW_DAYS;
  }).length;
  const stockValue = products.reduce(
    (sum, product) => sum + Number(product.quantityOnHand) * Number(product.costPrice),
    0,
  );

  const stats: InventoryStat[] = [
    { label: "Products", value: String(products.length), detail: `${suppliers.length} ${suppliers.length === 1 ? "supplier" : "suppliers"}` },
    { label: "Low stock", value: String(lowStock), detail: lowStock ? "Below reorder point" : "All healthy" },
    { label: "Expiring soon", value: String(expiringSoon), detail: `Next ${EXPIRY_WINDOW_DAYS} days` },
    { label: "Stock value", value: money(stockValue, currency), detail: "At cost price" },
  ];

  return {
    tenant: { id: business.id, name: business.name, slug: business.slug, currency: business.currency, categoryKey: business.category.key },
    stats,
    products: productRows,
    suppliers: suppliers.map((supplier) => ({ id: supplier.id, label: supplier.name })),
    movements: movements.map((movement) => {
      const qty = Number(movement.quantity);
      return {
        id: movement.id,
        product: movement.product.name,
        type: MOVEMENT_LABELS[movement.type] ?? movement.type,
        quantity: `${qty > 0 ? "+" : ""}${formatQty(qty)}`,
        when: shortDate(movement.createdAt),
      };
    }),
  };
}

export async function addProduct({
  businessSlug,
  name,
  category,
  supplier,
  costPrice,
  sellingPrice,
  quantityOnHand,
  reorderThreshold,
  expiryDate,
  barcode,
}: {
  businessSlug: string;
  name: string;
  category: string;
  supplier: string;
  costPrice: number;
  sellingPrice: number | null;
  quantityOnHand: number;
  reorderThreshold: number | null;
  expiryDate: Date | null;
  barcode: string;
}) {
  if (!isDatabaseConfigured()) {
    return;
  }

  const business = await prisma.business.findUnique({
    where: { slug: businessSlug },
    select: { id: true },
  });

  if (!business || !name.trim() || !Number.isFinite(costPrice) || costPrice < 0) {
    return;
  }

  // Supplier accepts typed input: match an existing supplier by name or create
  // one; blank means no supplier.
  const resolvedSupplierId = await findOrCreateSupplier(business.id, supplier);

  const openingQty = Number.isFinite(quantityOnHand) && quantityOnHand > 0 ? quantityOnHand : 0;

  // Create the product and, when it opens with stock, an audit trail entry —
  // in one transaction so the ledger can never drift from the on-hand count.
  await tenantTransaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        businessId: business.id,
        name: name.trim(),
        category: category.trim() || null,
        supplierId: resolvedSupplierId,
        costPrice,
        sellingPrice: sellingPrice != null && sellingPrice >= 0 ? sellingPrice : null,
        quantityOnHand: openingQty,
        reorderThreshold: reorderThreshold != null && reorderThreshold >= 0 ? reorderThreshold : null,
        expiryDate,
        barcode: barcode.trim() || null,
      },
    });

    if (openingQty > 0) {
      await tx.stockMovement.create({
        data: {
          businessId: business.id,
          productId: product.id,
          type: "PURCHASE_IN",
          quantity: openingQty,
          note: "Opening stock",
        },
      });
    }
  }, { timeout: 15000 });
}

export async function adjustStock({
  businessSlug,
  productId,
  delta,
  note,
}: {
  businessSlug: string;
  productId: string;
  delta: number;
  note: string;
}) {
  if (!isDatabaseConfigured() || !Number.isFinite(delta) || delta === 0) {
    return;
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, business: { slug: businessSlug } },
    select: { id: true, businessId: true, quantityOnHand: true },
  });

  if (!product) {
    return;
  }

  const current = Number(product.quantityOnHand);
  const next = Math.max(0, current + delta);
  const applied = next - current; // never drive on-hand below zero
  if (applied === 0) {
    return;
  }

  await tenantTransaction(async (tx) => {
    await tx.product.update({
      where: { id: product.id },
      data: { quantityOnHand: next },
    });
    await tx.stockMovement.create({
      data: {
        businessId: product.businessId,
        productId: product.id,
        type: applied > 0 ? "PURCHASE_IN" : "ADJUSTMENT",
        quantity: applied,
        note: note.trim() || (applied > 0 ? "Restock" : "Manual adjustment"),
      },
    });
  });
}

function dateInput(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "";
}

export async function getProductDetail(businessSlug: string, productId: string): Promise<ProductDetail | null> {
  if (!isDatabaseConfigured()) return null;

  const product = await prisma.product.findFirst({
    where: { id: productId, business: { slug: businessSlug } },
    include: {
      business: { select: { currency: true } },
      supplier: { select: { name: true } },
      _count: { select: { stockMovements: true } },
    },
  });
  if (!product) return null;

  return {
    id: product.id,
    name: product.name,
    sku: product.sku ?? "",
    barcode: product.barcode ?? "",
    category: product.category ?? "",
    supplier: product.supplier?.name ?? "",
    costPrice: String(product.costPrice),
    sellingPrice: product.sellingPrice != null ? String(product.sellingPrice) : "",
    reorderThreshold: product.reorderThreshold != null ? String(product.reorderThreshold) : "",
    expiryDate: dateInput(product.expiryDate),
    quantityOnHand: String(product.quantityOnHand),
    movementCount: product._count.stockMovements,
    currency: product.business.currency,
  };
}

/**
 * Update a product's ATTRIBUTES. Note what this does NOT touch: quantityOnHand.
 * Stock is a ledgered quantity — it changes only through adjustStock, which
 * writes a StockMovement, so on-hand can always be reconciled against the ledger.
 * Letting an edit form overwrite the number would silently break that.
 */
export async function updateProduct(input: {
  businessSlug: string;
  productId: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  supplier: string;
  costPrice: number;
  sellingPrice: number | null;
  reorderThreshold: number | null;
  expiryDate: Date | null;
}): Promise<InventoryWriteResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Database not configured" };

  if (!input.name.trim()) return { ok: false, error: "A product name is required." };
  if (!Number.isFinite(input.costPrice) || input.costPrice < 0) return { ok: false, error: "Enter a valid cost price." };
  if (input.sellingPrice != null && input.sellingPrice < input.costPrice) {
    // Selling below cost is a real choice sometimes, but far more often a typo;
    // block it so a slipped decimal doesn't quietly wreck margin reporting.
    return { ok: false, error: "Selling price is below cost. Double-check the figures." };
  }

  const product = await prisma.product.findFirst({
    where: { id: input.productId, business: { slug: input.businessSlug } },
    select: { id: true, businessId: true },
  });
  if (!product) return { ok: false, error: "That product no longer exists." };

  const supplierId = await findOrCreateSupplier(product.businessId, input.supplier);

  await prisma.product.update({
    where: { id: product.id },
    data: {
      name: input.name.trim(),
      sku: input.sku.trim() || null,
      barcode: input.barcode.trim() || null,
      category: input.category.trim() || null,
      supplierId,
      costPrice: input.costPrice,
      sellingPrice: input.sellingPrice,
      reorderThreshold: input.reorderThreshold,
      expiryDate: input.expiryDate,
    },
  });

  return { ok: true };
}

/**
 * Delete a product, permitted only when it has no stock movements.
 *
 * A product with a ledger is part of the audit record — deleting it would erase
 * history and could orphan service-usage links. With movements present, the
 * honest action is to write it down to zero (a tracked EXPIRY_WRITE_OFF or
 * ADJUSTMENT), not delete the row.
 */
export async function deleteProduct(businessSlug: string, productId: string): Promise<InventoryWriteResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Database not configured" };

  const product = await prisma.product.findFirst({
    where: { id: productId, business: { slug: businessSlug } },
    select: { id: true, _count: { select: { stockMovements: true, usedInServices: true } } },
  });
  if (!product) return { ok: false, error: "That product no longer exists." };

  if (product._count.stockMovements > 0 || product._count.usedInServices > 0) {
    return {
      ok: false,
      error: "This product has stock history or is used by a service. Write its stock down to zero instead of deleting it.",
    };
  }

  await prisma.product.delete({ where: { id: product.id } });
  return { ok: true };
}
