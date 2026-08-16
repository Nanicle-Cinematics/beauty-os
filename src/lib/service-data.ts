import "server-only";

import { prisma, tenantTransaction, isDatabaseConfigured } from "@/lib/prisma";
import { depositTarget } from "@/lib/money";

export type ServiceRow = {
  id: string;
  name: string;
  category: string;
  price: string;
  deposit: string;
  duration: string;
  staff: string[];
  bookings: number;
  colorHex: string;
  isActive: boolean;
};

export type ServiceStat = { label: string; value: string; detail: string };
export type ServiceOption = { id: string; label: string };

/** Every editable field on a service, plus the history that gates deletion. */
export type ServiceDetail = {
  id: string;
  name: string;
  description: string;
  price: string;
  depositAmount: string;
  durationMinutes: number;
  colorHex: string;
  categoryId: string;
  prepInstructions: string;
  cancellationPolicy: string;
  isActive: boolean;
  staffIds: string[];
  /** Bookings referencing this service. Non-zero means retire, never delete. */
  bookingCount: number;
  currency: string;
};

export type ServiceWriteResult = { ok: true } | { ok: false; error: string };

export type ServiceModuleData = {
  tenant: { id: string; name: string; slug: string; currency: string; categoryKey: string };
  stats: ServiceStat[];
  services: ServiceRow[];
  categories: ServiceOption[];
  staff: ServiceOption[];
};

function currencySymbol(currency: string) {
  return currency === "GHS" ? "GH₵" : currency;
}

function money(amount: number, currency: string) {
  return `${currencySymbol(currency)} ${Math.round(amount).toLocaleString("en-US")}`;
}

const fallbackServiceData: Record<string, ServiceModuleData> = {
  "osu-glow-studio": {
    tenant: { id: "sample_osu_glow", name: "Osu Glow Studio", slug: "osu-glow-studio", currency: "GHS", categoryKey: "hair_makeup_nails" },
    stats: [
      { label: "Active services", value: "5", detail: "All live" },
      { label: "Categories", value: "3", detail: "Signature services" },
      { label: "Average price", value: "GH₵ 546", detail: "Across active services" },
      { label: "Average duration", value: "1h 44m", detail: "Per service" },
    ],
    categories: [
      { id: "demo-cat-signature", label: "Signature services" },
      { id: "demo-cat-bridal", label: "Bridal" },
      { id: "demo-cat-hair", label: "Hair care" },
    ],
    staff: [{ id: "demo-staff-nadia", label: "Nadia Mensah" }],
    services: [
      { id: "demo-service-1", name: "Silk press + trim", category: "Hair care", price: "GH₵ 420", deposit: "GH₵ 210", duration: "1h 45m", staff: ["Nadia Mensah"], bookings: 18, colorHex: "#8b5cf6", isActive: true },
      { id: "demo-service-2", name: "Soft glam", category: "Signature services", price: "GH₵ 650", deposit: "GH₵ 325", duration: "1h 30m", staff: ["Nadia Mensah"], bookings: 24, colorHex: "#db2777", isActive: true },
      { id: "demo-service-3", name: "Wig install", category: "Signature services", price: "GH₵ 780", deposit: "GH₵ 390", duration: "2h 30m", staff: ["Nadia Mensah"], bookings: 12, colorHex: "#6d315f", isActive: true },
      { id: "demo-service-4", name: "Bridal trial", category: "Bridal", price: "GH₵ 580", deposit: "GH₵ 290", duration: "2h", staff: ["Nadia Mensah"], bookings: 7, colorHex: "#c084fc", isActive: true },
      { id: "demo-service-5", name: "Brow shape + tint", category: "Signature services", price: "GH₵ 300", deposit: "GH₵ 150", duration: "55m", staff: ["Nadia Mensah"], bookings: 15, colorHex: "#0f766e", isActive: true },
    ],
  },
  "luxe-lash-lab": {
    tenant: { id: "sample_luxe_lash", name: "Luxe Lash Lab", slug: "luxe-lash-lab", currency: "GHS", categoryKey: "lashes_brows" },
    stats: [
      { label: "Active services", value: "3", detail: "All live" },
      { label: "Categories", value: "2", detail: "Lashes and brows" },
      { label: "Average price", value: "GH₵ 267", detail: "Across active services" },
      { label: "Average duration", value: "1h 20m", detail: "Per service" },
    ],
    categories: [
      { id: "demo-cat-lashes", label: "Lashes" },
      { id: "demo-cat-brows", label: "Brows" },
    ],
    staff: [{ id: "demo-staff-mina", label: "Mina Owusu" }],
    services: [
      { id: "demo-service-6", name: "Classic lash set", category: "Lashes", price: "GH₵ 360", deposit: "GH₵ 180", duration: "1h 45m", staff: ["Mina Owusu"], bookings: 14, colorHex: "#7c3aed", isActive: true },
      { id: "demo-service-7", name: "Brow lamination", category: "Brows", price: "GH₵ 220", deposit: "GH₵ 110", duration: "1h", staff: ["Mina Owusu"], bookings: 10, colorHex: "#be185d", isActive: true },
      { id: "demo-service-8", name: "Lash refill", category: "Lashes", price: "GH₵ 220", deposit: "GH₵ 110", duration: "1h 15m", staff: ["Mina Owusu"], bookings: 21, colorHex: "#0f766e", isActive: true },
    ],
  },
};

export function formatDuration(minutes: number) {
  if (minutes <= 0) {
    return "—";
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours && mins) {
    return `${hours}h ${mins}m`;
  }
  if (hours) {
    return `${hours}h`;
  }
  return `${mins}m`;
}

export async function getServiceModuleData(businessSlug: string): Promise<ServiceModuleData | null> {
  if (!isDatabaseConfigured()) {
    return fallbackServiceData[businessSlug] ?? null;
  }

  const business = await prisma.business.findUnique({
    where: { slug: businessSlug },
    select: { id: true, name: true, slug: true, currency: true, category: { select: { key: true } } },
  });

  if (!business) {
    return null;
  }

  const [services, categories, staff] = await Promise.all([
    prisma.service.findMany({
      where: { businessId: business.id },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: {
        category: true,
        assignedStaff: { include: { staffMember: { include: { user: true } } } },
        _count: { select: { appointments: true } },
      },
    }),
    prisma.serviceCategory.findMany({
      where: { businessId: business.id },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.staffMember.findMany({
      where: { businessId: business.id, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      include: { user: true },
    }),
  ]);

  const currency = business.currency;
  const activeServices = services.filter((service) => service.isActive);
  const avgPrice = activeServices.length
    ? activeServices.reduce((sum, service) => sum + Number(service.price), 0) / activeServices.length
    : 0;
  const avgDuration = activeServices.length
    ? Math.round(activeServices.reduce((sum, service) => sum + service.durationMinutes, 0) / activeServices.length)
    : 0;

  const stats: ServiceStat[] = [
    {
      label: "Active services",
      value: String(activeServices.length),
      detail: services.length > activeServices.length ? `${services.length - activeServices.length} archived` : "All live",
    },
    {
      label: "Categories",
      value: String(categories.length),
      detail: categories.length ? categories[0].name : "None yet",
    },
    { label: "Average price", value: money(avgPrice, currency), detail: "Across active services" },
    { label: "Average duration", value: formatDuration(avgDuration), detail: "Per service" },
  ];

  return {
    tenant: { id: business.id, name: business.name, slug: business.slug, currency: business.currency, categoryKey: business.category.key },
    stats,
    services: services.map((service) => ({
      id: service.id,
      name: service.name,
      category: service.category?.name ?? "Uncategorised",
      price: money(Number(service.price), currency),
      deposit: money(depositTarget(Number(service.price)), currency),
      duration: formatDuration(service.durationMinutes),
      staff: service.assignedStaff.map(
        (link) => link.staffMember.user?.name ?? link.staffMember.invitedEmail ?? "Staff",
      ),
      bookings: service._count.appointments,
      colorHex: service.colorHex ?? "#9d4e7a",
      isActive: service.isActive,
    })),
    categories: categories.map((category) => ({ id: category.id, label: category.name })),
    staff: staff.map((member) => ({
      id: member.id,
      label: member.user?.name ?? member.invitedEmail ?? "Staff member",
    })),
  };
}

export async function createService({
  businessSlug,
  name,
  description,
  price,
  durationMinutes,
  colorHex,
  categoryId,
  newCategoryName,
  staffIds,
}: {
  businessSlug: string;
  name: string;
  description: string;
  price: number;
  durationMinutes: number;
  colorHex: string;
  categoryId: string;
  newCategoryName: string;
  staffIds: string[];
}) {
  if (!isDatabaseConfigured()) {
    return;
  }

  const business = await prisma.business.findUnique({
    where: { slug: businessSlug },
    select: { id: true },
  });

  if (!business || !name.trim() || !Number.isFinite(price) || price < 0 || durationMinutes <= 0) {
    return;
  }

  // Resolve category: a typed new name wins; otherwise use an existing one
  // that belongs to this business.
  let resolvedCategoryId: string | null = null;
  if (newCategoryName.trim()) {
    const created = await prisma.serviceCategory.create({
      data: { businessId: business.id, name: newCategoryName.trim() },
    });
    resolvedCategoryId = created.id;
  } else if (categoryId) {
    const existing = await prisma.serviceCategory.findFirst({
      where: { id: categoryId, businessId: business.id },
      select: { id: true },
    });
    resolvedCategoryId = existing?.id ?? null;
  }

  // Only assign staff who actually belong to this business.
  const validStaff = staffIds.length
    ? await prisma.staffMember.findMany({
        where: { id: { in: staffIds }, businessId: business.id },
        select: { id: true },
      })
    : [];

  await prisma.service.create({
    data: {
      businessId: business.id,
      name: name.trim(),
      description: description.trim() || null,
      price,
      depositAmount: null, // retired — deposit is 50% of price (money.ts)
      durationMinutes,
      colorHex: colorHex || null,
      categoryId: resolvedCategoryId,
      assignedStaff: validStaff.length
        ? { create: validStaff.map((member) => ({ staffMemberId: member.id })) }
        : undefined,
    },
  });
}

export async function toggleServiceActive({
  businessSlug,
  serviceId,
}: {
  businessSlug: string;
  serviceId: string;
}) {
  if (!isDatabaseConfigured()) {
    return;
  }

  const service = await prisma.service.findFirst({
    where: { id: serviceId, business: { slug: businessSlug } },
    select: { id: true, isActive: true },
  });

  if (!service) {
    return;
  }

  await prisma.service.update({
    where: { id: service.id },
    data: { isActive: !service.isActive },
  });
}

export async function getServiceDetail(businessSlug: string, serviceId: string): Promise<ServiceDetail | null> {
  if (!isDatabaseConfigured()) return null;

  const service = await prisma.service.findFirst({
    where: { id: serviceId, business: { slug: businessSlug } },
    include: {
      business: { select: { currency: true } },
      assignedStaff: { select: { staffMemberId: true } },
      _count: { select: { appointments: true } },
    },
  });
  if (!service) return null;

  return {
    id: service.id,
    name: service.name,
    description: service.description ?? "",
    price: String(service.price),
    depositAmount: service.depositAmount != null ? String(service.depositAmount) : "",
    durationMinutes: service.durationMinutes,
    colorHex: service.colorHex ?? "#6d315f",
    categoryId: service.categoryId ?? "",
    prepInstructions: service.prepInstructions ?? "",
    cancellationPolicy: service.cancellationPolicy ?? "",
    isActive: service.isActive,
    staffIds: service.assignedStaff.map((s) => s.staffMemberId),
    bookingCount: service._count.appointments,
    currency: service.business.currency,
  };
}

/** Just the dropdown contents for the edit form — no need to scan every service. */
export async function getServiceFormOptions(
  businessSlug: string,
): Promise<{ categories: ServiceOption[]; staff: ServiceOption[] } | null> {
  if (!isDatabaseConfigured()) return null;

  const business = await prisma.business.findUnique({ where: { slug: businessSlug }, select: { id: true } });
  if (!business) return null;

  const [categories, staff] = await Promise.all([
    prisma.serviceCategory.findMany({ where: { businessId: business.id }, orderBy: { sortOrder: "asc" } }),
    prisma.staffMember.findMany({
      where: { businessId: business.id, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      include: { user: true },
    }),
  ]);

  return {
    categories: categories.map((c) => ({ id: c.id, label: c.name })),
    staff: staff.map((m) => ({ id: m.id, label: m.user?.name ?? m.invitedEmail ?? "Staff member" })),
  };
}

export async function updateService(input: {
  businessSlug: string;
  serviceId: string;
  name: string;
  description: string;
  price: number;
  durationMinutes: number;
  colorHex: string;
  categoryId: string;
  newCategoryName: string;
  prepInstructions: string;
  cancellationPolicy: string;
  staffIds: string[];
}): Promise<ServiceWriteResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Database not configured" };

  if (!input.name.trim()) return { ok: false, error: "A service name is required." };
  if (!Number.isFinite(input.price) || input.price < 0) return { ok: false, error: "Enter a valid price." };
  if (!Number.isFinite(input.durationMinutes) || input.durationMinutes <= 0) {
    return { ok: false, error: "Duration must be at least 1 minute." };
  }

  const service = await prisma.service.findFirst({
    where: { id: input.serviceId, business: { slug: input.businessSlug } },
    select: { id: true, businessId: true },
  });
  if (!service) return { ok: false, error: "That service no longer exists." };

  // A typed-in category is created on the fly, matching the booking form's
  // find-or-create behaviour rather than trapping people in a fixed list.
  let categoryId: string | null = input.categoryId || null;
  if (input.newCategoryName.trim()) {
    const existing = await prisma.serviceCategory.findFirst({
      where: { businessId: service.businessId, name: { equals: input.newCategoryName.trim(), mode: "insensitive" } },
      select: { id: true },
    });
    categoryId =
      existing?.id ??
      (await prisma.serviceCategory.create({
        data: { businessId: service.businessId, name: input.newCategoryName.trim() },
        select: { id: true },
      })).id;
  }

  // Only staff of THIS business may be assigned — never trust posted ids.
  const validStaff = await prisma.staffMember.findMany({
    where: { businessId: service.businessId, id: { in: input.staffIds } },
    select: { id: true },
  });

  await tenantTransaction(
    async (tx) => {
      await tx.service.update({
        where: { id: service.id },
        data: {
          name: input.name.trim(),
          description: input.description.trim() || null,
          price: input.price,
          depositAmount: null, // retired — deposit is 50% of price (money.ts)
          durationMinutes: input.durationMinutes,
          colorHex: input.colorHex.trim() || null,
          categoryId,
          prepInstructions: input.prepInstructions.trim() || null,
          cancellationPolicy: input.cancellationPolicy.trim() || null,
        },
      });
      // Replace the assignment set wholesale — simpler and race-free versus
      // diffing, and the table is a pure join.
      await tx.serviceStaff.deleteMany({ where: { serviceId: service.id } });
      if (validStaff.length) {
        await tx.serviceStaff.createMany({
          data: validStaff.map((s) => ({ serviceId: service.id, staffMemberId: s.id })),
          skipDuplicates: true,
        });
      }
    },
    { timeout: 15000 },
  );

  return { ok: true };
}

export async function setServiceActive(
  businessSlug: string,
  serviceId: string,
  isActive: boolean,
): Promise<ServiceWriteResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Database not configured" };

  const { count } = await prisma.service.updateMany({
    where: { id: serviceId, business: { slug: businessSlug } },
    data: { isActive },
  });

  return count > 0 ? { ok: true } : { ok: false, error: "That service no longer exists." };
}

/**
 * Hard delete, permitted only for a service nothing has ever booked.
 *
 * Appointment.serviceId is required, so deleting a booked service would either
 * fail at the database or, worse, take its bookings with it. Retiring
 * (isActive = false) hides it from new bookings while the history survives.
 */
export async function deleteService(businessSlug: string, serviceId: string): Promise<ServiceWriteResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Database not configured" };

  const service = await prisma.service.findFirst({
    where: { id: serviceId, business: { slug: businessSlug } },
    select: { id: true, _count: { select: { appointments: true } } },
  });
  if (!service) return { ok: false, error: "That service no longer exists." };

  const bookings = service._count.appointments;
  if (bookings > 0) {
    return {
      ok: false,
      error: `${bookings} booking${bookings === 1 ? " uses" : "s use"} this service. Retire it instead — deleting would break that history.`,
    };
  }

  await prisma.service.delete({ where: { id: service.id } });
  return { ok: true };
}
