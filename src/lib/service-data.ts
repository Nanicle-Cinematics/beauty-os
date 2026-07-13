import "server-only";

import { prisma, isDatabaseConfigured } from "@/lib/prisma";

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

export type ServiceModuleData = {
  tenant: { id: string; name: string; slug: string; currency: string };
  stats: ServiceStat[];
  services: ServiceRow[];
  categories: ServiceOption[];
  staff: ServiceOption[];
};

const fallbackServiceData: Record<string, ServiceModuleData> = {
  "osu-glow-studio": {
    tenant: { id: "sample_osu_glow", name: "Osu Glow Studio", slug: "osu-glow-studio", currency: "GHS" },
    stats: [
      { label: "Active services", value: "3", detail: "1 category" },
      { label: "Categories", value: "1", detail: "Signature services" },
      { label: "Average price", value: "GH₵ 617", detail: "Across active services" },
      { label: "Average duration", value: "1h 40m", detail: "Per service" },
    ],
    services: [
      { id: "demo-service-1", name: "Silk press + trim", category: "Signature services", price: "GH₵ 420", deposit: "GH₵ 100", duration: "1h 30m", staff: ["Nadia Mensah"], bookings: 1, colorHex: "#10b981", isActive: true },
      { id: "demo-service-2", name: "Soft glam", category: "Signature services", price: "GH₵ 650", deposit: "GH₵ 150", duration: "1h 30m", staff: ["Nadia Mensah"], bookings: 1, colorHex: "#f43f5e", isActive: true },
      { id: "demo-service-3", name: "Wig install", category: "Signature services", price: "GH₵ 780", deposit: "GH₵ 200", duration: "2h", staff: ["Nadia Mensah"], bookings: 1, colorHex: "#2563eb", isActive: true },
    ],
    categories: [{ id: "demo-cat-1", label: "Signature services" }],
    staff: [{ id: "demo-staff-1", label: "Nadia Mensah" }],
  },
  "luxe-lash-lab": {
    tenant: { id: "sample_luxe_lash", name: "Luxe Lash Lab", slug: "luxe-lash-lab", currency: "GHS" },
    stats: [
      { label: "Active services", value: "2", detail: "1 category" },
      { label: "Categories", value: "1", detail: "Signature services" },
      { label: "Average price", value: "GH₵ 290", detail: "Across active services" },
      { label: "Average duration", value: "1h 30m", detail: "Per service" },
    ],
    services: [
      { id: "demo-service-4", name: "Classic lash set", category: "Signature services", price: "GH₵ 360", deposit: "GH₵ 80", duration: "2h", staff: ["Mina Owusu"], bookings: 1, colorHex: "#f43f5e", isActive: true },
      { id: "demo-service-5", name: "Brow lamination", category: "Signature services", price: "GH₵ 220", deposit: "GH₵ 50", duration: "1h", staff: ["Mina Owusu"], bookings: 1, colorHex: "#f59e0b", isActive: true },
    ],
    categories: [{ id: "demo-cat-2", label: "Signature services" }],
    staff: [{ id: "demo-staff-2", label: "Mina Owusu" }],
  },
};

function currencySymbol(currency: string) {
  return currency === "GHS" ? "GH₵" : currency;
}

function money(amount: number, currency: string) {
  return `${currencySymbol(currency)} ${Math.round(amount).toLocaleString("en-US")}`;
}

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
    select: { id: true, name: true, slug: true, currency: true },
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
    tenant: business,
    stats,
    services: services.map((service) => ({
      id: service.id,
      name: service.name,
      category: service.category?.name ?? "Uncategorised",
      price: money(Number(service.price), currency),
      deposit: service.depositAmount ? money(Number(service.depositAmount), currency) : "—",
      duration: formatDuration(service.durationMinutes),
      staff: service.assignedStaff.map(
        (link) => link.staffMember.user?.name ?? link.staffMember.invitedEmail ?? "Staff",
      ),
      bookings: service._count.appointments,
      colorHex: service.colorHex ?? "#1d7b5d",
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
  depositAmount,
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
  depositAmount: number | null;
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
      depositAmount: depositAmount != null && depositAmount > 0 ? depositAmount : null,
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
