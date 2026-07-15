import "server-only";

import { prisma, isDatabaseConfigured } from "@/lib/prisma";

const CAP = 50000; // bounded read for very large tenants

// Full export of a single tenant's data (data-subject portability). Runs under
// requireTenantAccess, so RLS scopes it; every query is also explicitly filtered
// by businessId as defense-in-depth.
export async function getBusinessExport(businessSlug: string) {
  if (!isDatabaseConfigured()) return null;
  const business = await prisma.business.findUnique({ where: { slug: businessSlug } });
  if (!business) return null;
  const businessId = business.id;

  const [
    staff,
    customers,
    services,
    appointments,
    payments,
    expenses,
    invoices,
    products,
    suppliers,
    stockMovements,
    campaigns,
    coupons,
    clientTiers,
  ] = await Promise.all([
    prisma.staffMember.findMany({ where: { businessId }, include: { user: { select: { email: true, name: true } } } }),
    prisma.customer.findMany({ where: { businessId }, take: CAP }),
    prisma.service.findMany({ where: { businessId } }),
    prisma.appointment.findMany({ where: { businessId }, take: CAP }),
    prisma.payment.findMany({ where: { businessId }, take: CAP }),
    prisma.expense.findMany({ where: { businessId }, take: CAP }),
    prisma.invoice.findMany({ where: { businessId }, take: CAP, include: { lineItems: true } }),
    prisma.product.findMany({ where: { businessId } }),
    prisma.supplier.findMany({ where: { businessId } }),
    prisma.stockMovement.findMany({ where: { businessId }, take: CAP }),
    prisma.campaign.findMany({ where: { businessId } }),
    prisma.coupon.findMany({ where: { businessId } }),
    prisma.clientTier.findMany({ where: { businessId } }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    business,
    staff,
    customers,
    services,
    appointments,
    payments,
    expenses,
    invoices,
    products,
    suppliers,
    stockMovements,
    campaigns,
    coupons,
    clientTiers,
  };
}
