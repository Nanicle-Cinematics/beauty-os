import "server-only";

import { prisma } from "@/lib/prisma";

// Resolve a free-typed client name to a customer id for the current tenant,
// creating the customer if no case-insensitive name match exists. Callers must
// already have scoped the tenant (requireTenantAccess) so RLS applies.
export async function findOrCreateCustomer(businessId: string, raw: string): Promise<string | null> {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) return null;

  const [firstName, ...rest] = name.split(" ");
  const lastName = rest.join(" ") || null;

  const existing = await prisma.customer.findFirst({
    where: {
      businessId,
      firstName: { equals: firstName, mode: "insensitive" },
      ...(lastName ? { lastName: { equals: lastName, mode: "insensitive" } } : { lastName: null }),
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.customer.create({
    data: { businessId, firstName, lastName },
    select: { id: true },
  });
  return created.id;
}

// Resolve a free-typed service name to a service (with the pricing fields a
// booking needs) for the current tenant, creating a starter service with
// sensible defaults if no case-insensitive name match exists. The owner can
// refine its price/duration later in the Services module.
export async function findOrCreateService(businessId: string, raw: string, defaultPrice?: number) {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) return null;

  const existing = await prisma.service.findFirst({
    where: { businessId, name: { equals: name, mode: "insensitive" } },
    select: { id: true, price: true, durationMinutes: true, depositAmount: true },
  });
  if (existing) return existing;

  const price = defaultPrice != null && Number.isFinite(defaultPrice) && defaultPrice >= 0 ? defaultPrice : 0;
  return prisma.service.create({
    data: { businessId, name, price, durationMinutes: 60, isActive: true },
    select: { id: true, price: true, durationMinutes: true, depositAmount: true },
  });
}

// Resolve a free-typed supplier name to a supplier id for the current tenant,
// creating it if no case-insensitive name match exists. Empty → null (no supplier).
export async function findOrCreateSupplier(businessId: string, raw: string): Promise<string | null> {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) return null;

  const existing = await prisma.supplier.findFirst({
    where: { businessId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.supplier.create({ data: { businessId, name }, select: { id: true } });
  return created.id;
}
