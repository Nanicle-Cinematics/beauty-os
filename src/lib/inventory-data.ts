import "server-only";

import { prisma, isDatabaseConfigured } from "@/lib/prisma";

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

export type InventoryModuleData = {
  tenant: { id: string; name: string; slug: string; currency: string };
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

const fallbackInventoryData: Record<string, InventoryModuleData> = {
  "osu-glow-studio": {
    tenant: { id: "sample_osu_glow", name: "Osu Glow Studio", slug: "osu-glow-studio", currency: "GHS" },
    stats: [
      { label: "Products", value: "3", detail: "0 suppliers" },
      { label: "Low stock", value: "3", detail: "Below reorder point" },
      { label: "Expiring soon", value: "0", detail: "Next 30 days" },
      { label: "Stock value", value: "GH₵ 260", detail: "At cost price" },
    ],
    products: [
      { id: "demo-p1", name: "Lace adhesive", category: "Hair", supplier: "—", stockLabel: "2 in stock", level: 20, status: "LOW", statusLabel: "Low", value: "GH₵ 90", expiry: "—" },
      { id: "demo-p2", name: "Developer 20 vol", category: "Color", supplier: "—", stockLabel: "4 in stock", level: 33, status: "LOW", statusLabel: "Low", value: "GH₵ 140", expiry: "—" },
      { id: "demo-p3", name: "Nude gel polish", category: "Nails", supplier: "—", stockLabel: "1 in stock", level: 12, status: "LOW", statusLabel: "Low", value: "GH₵ 30", expiry: "—" },
    ],
    suppliers: [],
    movements: [],
  },
  "luxe-lash-lab": {
    tenant: { id: "sample_luxe_lash", name: "Luxe Lash Lab", slug: "luxe-lash-lab", currency: "GHS" },
    stats: [
      { label: "Products", value: "2", detail: "0 suppliers" },
      { label: "Low stock", value: "1", detail: "Below reorder point" },
      { label: "Expiring soon", value: "0", detail: "Next 30 days" },
      { label: "Stock value", value: "GH₵ 460", detail: "At cost price" },
    ],
    products: [
      { id: "demo-p4", name: "Classic lash trays", category: "Lashes", supplier: "—", stockLabel: "6 in stock", level: 60, status: "OK", statusLabel: "In stock", value: "GH₵ 330", expiry: "—" },
      { id: "demo-p5", name: "Lash adhesive", category: "Lashes", supplier: "—", stockLabel: "2 in stock", level: 25, status: "LOW", statusLabel: "Low", value: "GH₵ 130", expiry: "—" },
    ],
    suppliers: [],
    movements: [],
  },
};

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
  if (!isDatabaseConfigured()) {
    return fallbackInventoryData[businessSlug] ?? null;
  }

  const business = await prisma.business.findUnique({
    where: { slug: businessSlug },
    select: { id: true, name: true, slug: true, currency: true },
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
    tenant: business,
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
  supplierId,
  newSupplierName,
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
  supplierId: string;
  newSupplierName: string;
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

  let resolvedSupplierId: string | null = null;
  if (newSupplierName.trim()) {
    const created = await prisma.supplier.create({
      data: { businessId: business.id, name: newSupplierName.trim() },
    });
    resolvedSupplierId = created.id;
  } else if (supplierId) {
    const existing = await prisma.supplier.findFirst({
      where: { id: supplierId, businessId: business.id },
      select: { id: true },
    });
    resolvedSupplierId = existing?.id ?? null;
  }

  const openingQty = Number.isFinite(quantityOnHand) && quantityOnHand > 0 ? quantityOnHand : 0;

  // Create the product and, when it opens with stock, an audit trail entry —
  // in one transaction so the ledger can never drift from the on-hand count.
  await prisma.$transaction(async (tx) => {
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
  });
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

  await prisma.$transaction([
    prisma.product.update({
      where: { id: product.id },
      data: { quantityOnHand: next },
    }),
    prisma.stockMovement.create({
      data: {
        businessId: product.businessId,
        productId: product.id,
        type: applied > 0 ? "PURCHASE_IN" : "ADJUSTMENT",
        quantity: applied,
        note: note.trim() || (applied > 0 ? "Restock" : "Manual adjustment"),
      },
    }),
  ]);
}
