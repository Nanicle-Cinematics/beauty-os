import "server-only";

import { prisma, tenantTransaction, isDatabaseConfigured } from "@/lib/prisma";
import { findOrCreateCustomer, findOrCreateService } from "@/lib/entity-resolve";
import { addMinutes } from "@/lib/date";
import { defaultHoldExpiry } from "@/lib/holds";

export type WaitlistRow = {
  id: string;
  client: string;
  service: string;
  staff: string;
  window: string;
  status: string;
  statusKey: string;
};

export type WaitlistDetail = {
  id: string;
  customerName: string;
  serviceName: string;
  preferredStaffId: string;
  earliestDate: string;
  latestDate: string;
  status: string;
};

export type WaitlistOption = { id: string; label: string };

export type WaitlistModuleData = {
  tenant: { id: string; name: string; slug: string };
  entries: WaitlistRow[];
  customers: WaitlistOption[];
  services: WaitlistOption[];
  staff: WaitlistOption[];
  waitingCount: number;
};

export type WaitlistWriteResult = { ok: true; appointmentId?: string } | { ok: false; error: string };

const STATUSES = ["WAITING", "NOTIFIED", "BOOKED", "EXPIRED"];

function readable(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function shortDate(d: Date | null) {
  return d ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }).format(d) : "";
}

function dateInput(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "";
}

export async function getWaitlistModuleData(businessSlug: string): Promise<WaitlistModuleData | null> {
  if (!isDatabaseConfigured()) return null;

  const business = await prisma.business.findUnique({
    where: { slug: businessSlug },
    select: { id: true, name: true, slug: true },
  });
  if (!business) return null;

  const [entries, customers, services, staff] = await Promise.all([
    prisma.waitlistEntry.findMany({
      where: { businessId: business.id },
      // Waiting first, then most recently added.
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        customer: true,
        service: true,
      },
    }),
    prisma.customer.findMany({ where: { businessId: business.id }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] }),
    prisma.service.findMany({ where: { businessId: business.id, isActive: true }, orderBy: { name: "asc" } }),
    prisma.staffMember.findMany({ where: { businessId: business.id, status: "ACTIVE" }, orderBy: { createdAt: "asc" }, include: { user: true } }),
  ]);

  // Resolve preferred-staff names in one pass (the entry only stores the id).
  const staffName = new Map(staff.map((m) => [m.id, m.user?.name ?? m.invitedEmail ?? "Staff member"]));

  const rows: WaitlistRow[] = entries.map((e) => {
    const window =
      e.earliestDate || e.latestDate
        ? `${shortDate(e.earliestDate) || "any"} – ${shortDate(e.latestDate) || "any"}`
        : "Any time";
    return {
      id: e.id,
      client: [e.customer.firstName, e.customer.lastName].filter(Boolean).join(" "),
      service: e.service.name,
      staff: e.preferredStaffId ? staffName.get(e.preferredStaffId) ?? "Any staff" : "Any staff",
      window,
      status: readable(e.status),
      statusKey: e.status,
    };
  });

  return {
    tenant: business,
    entries: rows,
    customers: customers.map((c) => ({ id: c.id, label: [c.firstName, c.lastName].filter(Boolean).join(" ") })),
    services: services.map((s) => ({ id: s.id, label: s.name })),
    staff: staff.map((m) => ({ id: m.id, label: m.user?.name ?? m.invitedEmail ?? "Staff member" })),
    waitingCount: entries.filter((e) => e.status === "WAITING").length,
  };
}

export async function getWaitlistDetail(businessSlug: string, entryId: string): Promise<WaitlistDetail | null> {
  if (!isDatabaseConfigured()) return null;
  const e = await prisma.waitlistEntry.findFirst({
    where: { id: entryId, business: { slug: businessSlug } },
    include: { customer: true, service: true },
  });
  if (!e) return null;
  return {
    id: e.id,
    customerName: [e.customer.firstName, e.customer.lastName].filter(Boolean).join(" "),
    serviceName: e.service.name,
    preferredStaffId: e.preferredStaffId ?? "",
    earliestDate: dateInput(e.earliestDate),
    latestDate: dateInput(e.latestDate),
    status: e.status,
  };
}

export async function createWaitlistEntry(input: {
  businessSlug: string;
  customer: string;
  service: string;
  preferredStaffId: string;
  earliestDate: Date | null;
  latestDate: Date | null;
}): Promise<WaitlistWriteResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Database not configured" };
  const business = await prisma.business.findUnique({ where: { slug: input.businessSlug }, select: { id: true } });
  if (!business) return { ok: false, error: "Workspace not found." };

  if (!input.customer.trim()) return { ok: false, error: "A client is required." };
  if (!input.service.trim()) return { ok: false, error: "A service is required." };
  if (input.earliestDate && input.latestDate && input.latestDate < input.earliestDate) {
    return { ok: false, error: "The latest date can't be before the earliest." };
  }

  const customerId = await findOrCreateCustomer(business.id, input.customer);
  const svc = await findOrCreateService(business.id, input.service);
  if (!customerId || !svc) return { ok: false, error: "Couldn't resolve the client or service." };

  const staff = input.preferredStaffId
    ? await prisma.staffMember.findFirst({ where: { id: input.preferredStaffId, businessId: business.id }, select: { id: true } })
    : null;

  await prisma.waitlistEntry.create({
    data: {
      businessId: business.id,
      customerId,
      serviceId: svc.id,
      preferredStaffId: staff?.id ?? null,
      earliestDate: input.earliestDate,
      latestDate: input.latestDate,
    },
  });
  return { ok: true };
}

export async function updateWaitlistEntry(input: {
  businessSlug: string;
  entryId: string;
  customer: string;
  service: string;
  preferredStaffId: string;
  earliestDate: Date | null;
  latestDate: Date | null;
  status: string;
}): Promise<WaitlistWriteResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Database not configured" };
  if (!STATUSES.includes(input.status)) return { ok: false, error: "Invalid status." };
  if (input.earliestDate && input.latestDate && input.latestDate < input.earliestDate) {
    return { ok: false, error: "The latest date can't be before the earliest." };
  }

  const entry = await prisma.waitlistEntry.findFirst({
    where: { id: input.entryId, business: { slug: input.businessSlug } },
    select: { id: true, businessId: true },
  });
  if (!entry) return { ok: false, error: "That waitlist entry no longer exists." };

  const customerId = await findOrCreateCustomer(entry.businessId, input.customer);
  const svc = await findOrCreateService(entry.businessId, input.service);
  if (!customerId || !svc) return { ok: false, error: "Couldn't resolve the client or service." };

  const staff = input.preferredStaffId
    ? await prisma.staffMember.findFirst({ where: { id: input.preferredStaffId, businessId: entry.businessId }, select: { id: true } })
    : null;

  await prisma.waitlistEntry.update({
    where: { id: entry.id },
    data: {
      customerId,
      serviceId: svc.id,
      preferredStaffId: staff?.id ?? null,
      earliestDate: input.earliestDate,
      latestDate: input.latestDate,
      status: input.status as "WAITING" | "NOTIFIED" | "BOOKED" | "EXPIRED",
    },
  });
  return { ok: true };
}

export async function setWaitlistStatus(
  businessSlug: string,
  entryId: string,
  status: string,
): Promise<WaitlistWriteResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Database not configured" };
  if (!STATUSES.includes(status)) return { ok: false, error: "Invalid status." };
  const { count } = await prisma.waitlistEntry.updateMany({
    where: { id: entryId, business: { slug: businessSlug } },
    data: { status: status as "WAITING" | "NOTIFIED" | "BOOKED" | "EXPIRED" },
  });
  return count > 0 ? { ok: true } : { ok: false, error: "That waitlist entry no longer exists." };
}

export async function deleteWaitlistEntry(businessSlug: string, entryId: string): Promise<WaitlistWriteResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Database not configured" };
  const { count } = await prisma.waitlistEntry.deleteMany({ where: { id: entryId, business: { slug: businessSlug } } });
  return count > 0 ? { ok: true } : { ok: false, error: "That waitlist entry no longer exists." };
}

/**
 * Turn a waiting client into a provisional hold, then mark the entry BOOKED.
 *
 * A hold, not a confirmed booking: it reserves the slot while staff confirm the
 * exact time with the client — which is the whole point of a waitlist (they
 * wanted a slot that wasn't free). The start time is a sensible default (the
 * window's earliest date, else tomorrow, at noon UTC); staff set the real time
 * on the appointment page. Returns the appointment id so the caller can go
 * straight there. Both writes are one transaction so a promoted entry always has
 * its hold.
 */
export async function promoteWaitlistEntry(businessSlug: string, entryId: string): Promise<WaitlistWriteResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Database not configured" };

  const entry = await prisma.waitlistEntry.findFirst({
    where: { id: entryId, business: { slug: businessSlug } },
    include: { service: { select: { id: true, price: true, durationMinutes: true, depositAmount: true } } },
  });
  if (!entry) return { ok: false, error: "That waitlist entry no longer exists." };
  if (entry.status === "BOOKED") return { ok: false, error: "This client has already been booked." };

  // Preferred staff if still active, else the first active member — a hold needs
  // someone to hold the slot against.
  const staff =
    (entry.preferredStaffId
      ? await prisma.staffMember.findFirst({ where: { id: entry.preferredStaffId, businessId: entry.businessId, status: "ACTIVE" }, select: { id: true } })
      : null) ??
    (await prisma.staffMember.findFirst({ where: { businessId: entry.businessId, status: "ACTIVE" }, orderBy: { createdAt: "asc" }, select: { id: true } }));
  if (!staff) return { ok: false, error: "Add an active staff member before promoting from the waitlist." };

  const base = entry.earliestDate ?? new Date(Date.now() + 24 * 60 * 60 * 1000);
  const startAt = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 12, 0, 0));
  const endAt = addMinutes(startAt, entry.service.durationMinutes);

  const appointment = await tenantTransaction(async (tx) => {
    const created = await tx.appointment.create({
      data: {
        businessId: entry.businessId,
        customerId: entry.customerId,
        serviceId: entry.service.id,
        staffMemberId: staff.id,
        startAt,
        endAt,
        status: "HOLD",
        source: "ADMIN",
        price: entry.service.price,
        depositAmount: entry.service.depositAmount,
        depositPaid: false,
        holdExpiresAt: defaultHoldExpiry(startAt),
        holdPriority: 1,
      },
      select: { id: true },
    });
    await tx.waitlistEntry.update({ where: { id: entry.id }, data: { status: "BOOKED" } });
    return created;
  }, { timeout: 15000 });

  return { ok: true, appointmentId: appointment.id };
}
