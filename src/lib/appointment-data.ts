import "server-only";

import { addMinutes, format } from "@/lib/date";
import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { findOrCreateCustomer, findOrCreateService } from "@/lib/entity-resolve";
import { defaultHoldExpiry, holdExpiryLabel, isHoldExpired } from "@/lib/holds";

export type AppointmentRow = {
  id: string;
  time: string;
  client: string;
  service: string;
  staff: string;
  status: string;
  value: string;
  /** Provisional booking — reserved, not committed. See docs/HOLDS.md. */
  isHold: boolean;
  /** A hold past its expiry. Soft signal only: staff may still firm it. */
  holdExpired: boolean;
  /** e.g. "expires in 3 days" / "expired". Null unless this is a hold. */
  holdExpiryLabel: string | null;
};

/** Result of a hold transition, so the caller can surface a real reason. */
export type HoldOutcome = { ok: true } | { ok: false; error: string };

export type AppointmentOption = {
  id: string;
  label: string;
};

export type AppointmentModuleData = {
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  appointments: AppointmentRow[];
  customers: AppointmentOption[];
  services: AppointmentOption[];
  staff: AppointmentOption[];
};

const fallbackAppointmentData: Record<string, AppointmentModuleData> = {
  "osu-glow-studio": {
    tenant: { id: "sample_osu_glow", name: "Osu Glow Studio", slug: "osu-glow-studio" },
    appointments: [
      { id: "demo-1", time: "09:00", client: "Ama Serwaa", service: "Silk press + trim", staff: "Nadia", status: "CONFIRMED", value: "GH₵ 420", isHold: false, holdExpired: false, holdExpiryLabel: null },
      { id: "demo-2", time: "10:30", client: "Esi Manu", service: "Soft glam", staff: "Nadia", status: "PENDING", value: "GH₵ 650", isHold: false, holdExpired: false, holdExpiryLabel: null },
      { id: "demo-3", time: "12:00", client: "Akua Mensah", service: "Wig install", staff: "Nadia", status: "Hold", value: "GH₵ 780", isHold: true, holdExpired: false, holdExpiryLabel: "expires in 3 days" },
    ],
    customers: [
      { id: "demo-customer-1", label: "Ama Serwaa" },
      { id: "demo-customer-2", label: "Esi Manu" },
      { id: "demo-customer-3", label: "Akua Mensah" },
    ],
    services: [
      { id: "demo-service-1", label: "Silk press + trim" },
      { id: "demo-service-2", label: "Soft glam" },
      { id: "demo-service-3", label: "Wig install" },
    ],
    staff: [{ id: "demo-staff-1", label: "Nadia Mensah" }],
  },
  "luxe-lash-lab": {
    tenant: { id: "sample_luxe_lash", name: "Luxe Lash Lab", slug: "luxe-lash-lab" },
    appointments: [
      { id: "demo-4", time: "09:00", client: "Yaa Boateng", service: "Classic lash set", staff: "Mina", status: "CONFIRMED", value: "GH₵ 360", isHold: false, holdExpired: false, holdExpiryLabel: null },
      { id: "demo-5", time: "11:30", client: "Afia Owusu", service: "Brow lamination", staff: "Mina", status: "PENDING", value: "GH₵ 220", isHold: false, holdExpired: false, holdExpiryLabel: null },
    ],
    customers: [
      { id: "demo-customer-4", label: "Yaa Boateng" },
      { id: "demo-customer-5", label: "Afia Owusu" },
    ],
    services: [
      { id: "demo-service-4", label: "Classic lash set" },
      { id: "demo-service-5", label: "Brow lamination" },
    ],
    staff: [{ id: "demo-staff-2", label: "Mina Owusu" }],
  },
};

function money(amount: { toString(): string }, currency = "GH₵") {
  return `${currency} ${Number(amount.toString()).toLocaleString("en-US")}`;
}

function readableStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Appointments for the same staff member whose time range intersects
 * [startAt, endAt). Half-open on purpose: a booking that ends exactly when the
 * next begins does not overlap.
 *
 * Backed by the @@index([businessId, staffMemberId, startAt, endAt]) added for
 * this feature.
 */
async function findOverlapping({
  businessId,
  staffMemberId,
  startAt,
  endAt,
  statuses,
  excludeId,
}: {
  businessId: string;
  staffMemberId: string;
  startAt: Date;
  endAt: Date;
  statuses: ("HOLD" | "PENDING" | "CONFIRMED" | "COMPLETED")[];
  excludeId?: string;
}) {
  return prisma.appointment.findMany({
    where: {
      businessId,
      staffMemberId,
      status: { in: statuses },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    include: { customer: true, staffMember: { include: { user: true } } },
  });
}

export async function getAppointmentModuleData(businessSlug: string): Promise<AppointmentModuleData | null> {
  if (!isDatabaseConfigured()) {
    return fallbackAppointmentData[businessSlug] ?? null;
  }

  const business = await prisma.business.findUnique({
    where: { slug: businessSlug },
    select: { id: true, name: true, slug: true, currency: true },
  });

  if (!business) {
    return null;
  }

  const [appointments, customers, services, staff] = await Promise.all([
    prisma.appointment.findMany({
      where: { businessId: business.id },
      orderBy: { startAt: "asc" },
      include: {
        customer: true,
        service: true,
        staffMember: { include: { user: true } },
      },
    }),
    prisma.customer.findMany({
      where: { businessId: business.id },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.service.findMany({
      where: { businessId: business.id, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.staffMember.findMany({
      where: { businessId: business.id, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      include: { user: true },
    }),
  ]);

  const now = new Date();

  return {
    tenant: business,
    appointments: appointments.map((appointment) => {
      const isHold = appointment.status === "HOLD";
      return {
        id: appointment.id,
        time: format(appointment.startAt),
        client: [appointment.customer.firstName, appointment.customer.lastName].filter(Boolean).join(" "),
        service: appointment.service.name,
        staff: appointment.staffMember?.user?.name ?? appointment.staffMember?.invitedEmail ?? "Unassigned",
        status: readableStatus(appointment.status),
        value: money(appointment.price, business.currency === "GHS" ? "GH₵" : business.currency),
        isHold,
        holdExpired: isHold && isHoldExpired(appointment.holdExpiresAt, now),
        holdExpiryLabel: isHold ? holdExpiryLabel(appointment.holdExpiresAt, now) : null,
      };
    }),
    customers: customers.map((customer) => ({
      id: customer.id,
      label: [customer.firstName, customer.lastName].filter(Boolean).join(" "),
    })),
    services: services.map((service) => ({ id: service.id, label: service.name })),
    staff: staff.map((person) => ({
      id: person.id,
      label: person.user?.name ?? person.invitedEmail ?? "Staff member",
    })),
  };
}

export async function createAppointment({
  businessSlug,
  customer,
  service,
  staffMemberId,
  startAt,
  price,
  hold = false,
  holdExpiresAt,
}: {
  businessSlug: string;
  customer: string;
  service: string;
  staffMemberId: string;
  startAt: Date;
  price?: number | null;
  /** Create provisionally: reserves the slot without committing (docs/HOLDS.md). */
  hold?: boolean;
  /** Only meaningful with hold; defaults to 7 days out, capped at the date itself. */
  holdExpiresAt?: Date | null;
}) {
  if (!isDatabaseConfigured()) {
    return;
  }

  const business = await prisma.business.findUnique({ where: { slug: businessSlug }, select: { id: true } });

  if (!business) {
    return;
  }

  const staffMember = await prisma.staffMember.findFirst({
    where: { id: staffMemberId, businessId: business.id, status: "ACTIVE" },
    select: { id: true },
  });
  if (!staffMember) {
    return;
  }

  // Client and service accept typed input: match an existing record by name, or
  // create one on the fly. An optional price overrides the booking price and, if
  // a new service is created, seeds its price (else a new service starts at
  // GH₵0 / 60 min to refine later; an existing service keeps its own price).
  const override = price != null && Number.isFinite(price) && price >= 0 ? price : undefined;
  const customerId = await findOrCreateCustomer(business.id, customer);
  const svc = await findOrCreateService(business.id, service, override);
  if (!customerId || !svc) {
    return;
  }

  await prisma.appointment.create({
    data: {
      businessId: business.id,
      customerId,
      serviceId: svc.id,
      staffMemberId: staffMember.id,
      startAt,
      endAt: addMinutes(startAt, svc.durationMinutes),
      status: hold ? "HOLD" : "CONFIRMED",
      source: "ADMIN",
      price: override != null ? override : svc.price,
      depositAmount: svc.depositAmount,
      // A hold is never paid — nothing has been committed yet.
      depositPaid: hold ? false : Boolean(svc.depositAmount),
      holdExpiresAt: hold ? (holdExpiresAt ?? defaultHoldExpiry(startAt)) : null,
    },
  });
}

/**
 * HOLD -> CONFIRMED. Refuses if the staff member already has a committed
 * booking overlapping the slot; that is the one case where two records would
 * be a genuine contradiction rather than a judgement call.
 */
export async function firmHold({
  businessSlug,
  appointmentId,
}: {
  businessSlug: string;
  appointmentId: string;
}): Promise<HoldOutcome> {
  if (!isDatabaseConfigured()) {
    return { ok: false, error: "Database not configured" };
  }

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, business: { slug: businessSlug } },
    select: { id: true, businessId: true, staffMemberId: true, startAt: true, endAt: true, status: true },
  });

  if (!appointment) {
    return { ok: false, error: "That booking no longer exists" };
  }
  if (appointment.status !== "HOLD") {
    return { ok: false, error: "That booking is not a hold" };
  }

  if (appointment.staffMemberId) {
    const clashes = await findOverlapping({
      businessId: appointment.businessId,
      staffMemberId: appointment.staffMemberId,
      startAt: appointment.startAt,
      endAt: appointment.endAt,
      statuses: ["CONFIRMED"],
      excludeId: appointment.id,
    });

    if (clashes.length > 0) {
      const clash = clashes[0];
      const who = [clash.customer.firstName, clash.customer.lastName].filter(Boolean).join(" ");
      const staffName = clash.staffMember?.user?.name ?? "That staff member";
      return { ok: false, error: `${staffName} is already booked for ${who} at that time` };
    }
  }

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: "CONFIRMED", holdPriority: null, holdExpiresAt: null },
  });

  return { ok: true };
}

/**
 * HOLD -> CANCELLED, tagged so a released hold is distinguishable from a real
 * cancellation. Mapping onto CANCELLED (rather than a new status) is what keeps
 * released holds flowing through every existing exclusion path — docs/HOLDS.md.
 */
export async function releaseHold({
  businessSlug,
  appointmentId,
}: {
  businessSlug: string;
  appointmentId: string;
}): Promise<HoldOutcome> {
  if (!isDatabaseConfigured()) {
    return { ok: false, error: "Database not configured" };
  }

  const { count } = await prisma.appointment.updateMany({
    where: { id: appointmentId, business: { slug: businessSlug }, status: "HOLD" },
    data: {
      status: "CANCELLED",
      cancelReason: "Hold released",
      cancelledAt: new Date(),
      holdPriority: null,
      holdExpiresAt: null,
    },
  });

  return count > 0 ? { ok: true } : { ok: false, error: "That hold no longer exists" };
}

export async function updateAppointmentStatus({
  businessSlug,
  appointmentId,
  status,
}: {
  businessSlug: string;
  appointmentId: string;
  status: "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
}) {
  if (!isDatabaseConfigured()) {
    return;
  }

  await prisma.appointment.updateMany({
    where: {
      id: appointmentId,
      business: { slug: businessSlug },
    },
    data: {
      status,
      cancelledAt: status === "CANCELLED" ? new Date() : null,
    },
  });
}
