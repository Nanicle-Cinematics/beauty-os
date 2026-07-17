import "server-only";

import { addMinutes, format, formatLongDateInTz, formatTimeInTz, toLocalInput, fromLocalInput } from "@/lib/date";
import { prisma, tenantTransaction, isDatabaseConfigured } from "@/lib/prisma";
import { findOrCreateCustomer, findOrCreateService } from "@/lib/entity-resolve";
import {
  defaultHoldExpiry,
  holdExpiryLabel,
  isHoldExpired,
  holdQueueLabel,
  nextHoldPriority,
  promoteLadder,
} from "@/lib/holds";
import { sendHoldPromotedEmail, sendHoldReleasedEmail } from "@/lib/email";

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
  /** e.g. "2nd in line" — this hold's place in the queue for a contended slot. */
  holdQueueLabel: string | null;
};

/** Result of a hold transition, so the caller can surface a real reason. */
export type HoldOutcome =
  | {
      ok: true;
      /** Rival holds bumped because someone else confirmed the slot. */
      releasedCount?: number;
      /** Client promoted to the front of the queue, if any. */
      promotedName?: string | null;
    }
  | { ok: false; error: string };

/**
 * Every editable field on an appointment, plus the payment facts that gate
 * deletion. `price` is booked value and IS editable; `collected` is derived from
 * Payment rows and is never touched by editing the appointment (see money.ts).
 */
export type AppointmentDetail = {
  id: string;
  customerName: string;
  serviceName: string;
  staffMemberId: string;
  startAtLocal: string; // "YYYY-MM-DDThh:mm" for datetime-local, in business tz
  status: string;
  price: string;
  depositAmount: string;
  notes: string;
  isHold: boolean;
  /** Hold-only: expiry as a date input value, and queue position. */
  holdExpiresAtLocal: string;
  holdPriority: string;
  paymentCount: number;
  collected: string;
  outstanding: string;
  currency: string;
};

export type AppointmentWriteResult = { ok: true } | { ok: false; error: string };

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
      { id: "demo-1", time: "09:00", client: "Ama Serwaa", service: "Silk press + trim", staff: "Nadia", status: "CONFIRMED", value: "GH₵ 420", isHold: false, holdExpired: false, holdExpiryLabel: null, holdQueueLabel: null },
      { id: "demo-2", time: "10:30", client: "Esi Manu", service: "Soft glam", staff: "Nadia", status: "PENDING", value: "GH₵ 650", isHold: false, holdExpired: false, holdExpiryLabel: null, holdQueueLabel: null },
      { id: "demo-3", time: "12:00", client: "Akua Mensah", service: "Wig install", staff: "Nadia", status: "Hold", value: "GH₵ 780", isHold: true, holdExpired: false, holdExpiryLabel: "expires in 3 days", holdQueueLabel: null },
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
      { id: "demo-4", time: "09:00", client: "Yaa Boateng", service: "Classic lash set", staff: "Mina", status: "CONFIRMED", value: "GH₵ 360", isHold: false, holdExpired: false, holdExpiryLabel: null, holdQueueLabel: null },
      { id: "demo-5", time: "11:30", client: "Afia Owusu", service: "Brow lamination", staff: "Mina", status: "PENDING", value: "GH₵ 220", isHold: false, holdExpired: false, holdExpiryLabel: null, holdQueueLabel: null },
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
    orderBy: { holdPriority: "asc" },
    include: { customer: true, service: true, staffMember: { include: { user: true } } },
  });
}

type NotifiableHold = {
  id: string;
  startAt: Date;
  customer: { id: string; firstName: string; lastName: string | null; email: string | null };
  service: { name: string };
};

type EmailBusiness = { id: string; name: string; phone: string | null; timezone: string };

/**
 * Email a client about their hold. Best-effort by design: a client with no email
 * on file is simply skipped, and a transport failure is already swallowed and
 * logged to NotificationLog by sendEmail — losing a courtesy note must never
 * fail the staff member's action.
 *
 * These are transactional, not marketing, so marketing opt-ins don't gate them.
 */
async function notifyHold(
  kind: "promoted" | "released",
  hold: NotifiableHold,
  business: EmailBusiness,
): Promise<string | null> {
  const to = hold.customer.email;
  if (!to) return null;

  const clientName = [hold.customer.firstName, hold.customer.lastName].filter(Boolean).join(" ");
  const when = `${formatLongDateInTz(hold.startAt, business.timezone)} at ${formatTimeInTz(hold.startAt, business.timezone)}`;
  const shared = {
    to,
    clientName,
    businessName: business.name,
    serviceName: hold.service.name,
    when,
    businessId: business.id,
    customerId: hold.customer.id,
  };

  if (kind === "promoted") {
    await sendHoldPromotedEmail({ ...shared, businessPhone: business.phone });
  } else {
    await sendHoldReleasedEmail(shared);
  }
  return clientName;
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
        // Only worth showing when someone is actually queued behind another
        // hold; "1st in line" with nobody behind you is noise.
        holdQueueLabel: isHold && (appointment.holdPriority ?? 0) > 1 ? holdQueueLabel(appointment.holdPriority) : null,
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

  const endAt = addMinutes(startAt, svc.durationMinutes);

  // A new hold joins the back of the queue for whatever already contends this slot.
  let holdPriority: number | null = null;
  if (hold) {
    const rivals = await findOverlapping({
      businessId: business.id,
      staffMemberId: staffMember.id,
      startAt,
      endAt,
      statuses: ["HOLD"],
    });
    holdPriority = nextHoldPriority(rivals.map((r) => r.holdPriority));
  }

  await prisma.appointment.create({
    data: {
      businessId: business.id,
      customerId,
      serviceId: svc.id,
      staffMemberId: staffMember.id,
      startAt,
      endAt,
      status: hold ? "HOLD" : "CONFIRMED",
      source: "ADMIN",
      price: override != null ? override : svc.price,
      depositAmount: svc.depositAmount,
      // Never paid at creation. This previously read `Boolean(svc.depositAmount)`,
      // which recorded "this service requires a deposit" as "the deposit was
      // paid" — booking a service invented collected money nobody had handed
      // over, and the unpaid-deposit chase lists could never fire. A deposit is
      // settled in exactly one place: recordPayment, when a DEPOSIT payment is
      // actually taken. See src/lib/money.ts.
      depositPaid: false,
      holdExpiresAt: hold ? (holdExpiresAt ?? defaultHoldExpiry(startAt)) : null,
      holdPriority,
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
    select: {
      id: true,
      businessId: true,
      staffMemberId: true,
      startAt: true,
      endAt: true,
      status: true,
      business: { select: { id: true, name: true, phone: true, timezone: true } },
    },
  });

  if (!appointment) {
    return { ok: false, error: "That booking no longer exists" };
  }
  if (appointment.status !== "HOLD") {
    return { ok: false, error: "That booking is not a hold" };
  }

  let losers: NotifiableHold[] = [];

  if (appointment.staffMemberId) {
    const overlapping = await findOverlapping({
      businessId: appointment.businessId,
      staffMemberId: appointment.staffMemberId,
      startAt: appointment.startAt,
      endAt: appointment.endAt,
      statuses: ["CONFIRMED", "HOLD"],
      excludeId: appointment.id,
    });

    const clash = overlapping.find((a) => a.status === "CONFIRMED");
    if (clash) {
      const who = [clash.customer.firstName, clash.customer.lastName].filter(Boolean).join(" ");
      const staffName = clash.staffMember?.user?.name ?? "That staff member";
      return { ok: false, error: `${staffName} is already booked for ${who} at that time` };
    }

    // Confirming takes the slot, so every rival hold on it is now dead.
    losers = overlapping.filter((a) => a.status === "HOLD");
  }

  await tenantTransaction(
    async (tx) => {
      await tx.appointment.update({
        where: { id: appointment.id },
        data: { status: "CONFIRMED", holdPriority: null, holdExpiresAt: null },
      });

      if (losers.length > 0) {
        await tx.appointment.updateMany({
          where: { id: { in: losers.map((l) => l.id) } },
          data: {
            status: "CANCELLED",
            cancelReason: "Slot booked by another client",
            cancelledAt: new Date(),
            holdPriority: null,
            holdExpiresAt: null,
          },
        });
      }
    },
    { timeout: 15000 },
  );

  // Emails go out after the transaction commits — never hold a database
  // transaction open across an SMTP round-trip.
  for (const loser of losers) {
    await notifyHold("released", loser, appointment.business);
  }

  return { ok: true, releasedCount: losers.length };
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

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, business: { slug: businessSlug }, status: "HOLD" },
    select: {
      id: true,
      businessId: true,
      staffMemberId: true,
      startAt: true,
      endAt: true,
      holdPriority: true,
      business: { select: { id: true, name: true, phone: true, timezone: true } },
    },
  });

  if (!appointment) {
    return { ok: false, error: "That hold no longer exists" };
  }

  const behind = appointment.staffMemberId
    ? await findOverlapping({
        businessId: appointment.businessId,
        staffMemberId: appointment.staffMemberId,
        startAt: appointment.startAt,
        endAt: appointment.endAt,
        statuses: ["HOLD"],
        excludeId: appointment.id,
      })
    : [];

  // A hold with no priority predates the ladder and was never in the queue, so
  // releasing it must not shuffle anyone.
  const promotions = appointment.holdPriority != null ? promoteLadder(behind, appointment.holdPriority) : [];

  await tenantTransaction(
    async (tx) => {
      await tx.appointment.update({
        where: { id: appointment.id },
        data: {
          status: "CANCELLED",
          cancelReason: "Hold released",
          cancelledAt: new Date(),
          holdPriority: null,
          holdExpiresAt: null,
        },
      });

      for (const promotion of promotions) {
        await tx.appointment.update({
          where: { id: promotion.id },
          data: { holdPriority: promotion.priority },
        });
      }
    },
    { timeout: 15000 },
  );

  // Only the client who reached the front of the queue is told: they're the one
  // who can now actually have the date.
  const first = promotions.find((p) => p.becomesFirst);
  const promoted = first ? behind.find((h) => h.id === first.id) : undefined;
  const promotedName = promoted ? await notifyHold("promoted", promoted, appointment.business) : null;

  return { ok: true, promotedName };
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

const moneyCode = (amount: number, currency: string) =>
  `${currency === "GHS" ? "GH₵" : currency} ${Math.round(amount).toLocaleString("en-US")}`;

export async function getAppointmentDetail(businessSlug: string, appointmentId: string): Promise<AppointmentDetail | null> {
  if (!isDatabaseConfigured()) return null;

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, business: { slug: businessSlug } },
    include: {
      business: { select: { currency: true, timezone: true } },
      customer: true,
      service: true,
      payments: { select: { amount: true, type: true, status: true } },
    },
  });
  if (!appointment) return null;

  const currency = appointment.business.currency;
  const tz = appointment.business.timezone || "UTC";

  // Collected is derived from real payments — settlement types in, minus refunds
  // — exactly as everywhere else. Editing the appointment never changes it.
  const paid = appointment.payments
    .filter((p) => p.status === "SUCCESS" && ["DEPOSIT", "FULL_PAYMENT", "BALANCE"].includes(p.type))
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const refunded = appointment.payments
    .filter((p) => p.status === "SUCCESS" && p.type === "REFUND")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const collected = paid - refunded;
  const outstanding = Math.max(0, Number(appointment.price) - paid);

  return {
    id: appointment.id,
    customerName: [appointment.customer.firstName, appointment.customer.lastName].filter(Boolean).join(" "),
    serviceName: appointment.service.name,
    staffMemberId: appointment.staffMemberId ?? "",
    startAtLocal: toLocalInput(appointment.startAt, tz),
    status: appointment.status,
    price: String(appointment.price),
    depositAmount: appointment.depositAmount != null ? String(appointment.depositAmount) : "",
    notes: appointment.notes ?? "",
    isHold: appointment.status === "HOLD",
    holdExpiresAtLocal: appointment.holdExpiresAt ? appointment.holdExpiresAt.toISOString().slice(0, 10) : "",
    holdPriority: appointment.holdPriority != null ? String(appointment.holdPriority) : "",
    paymentCount: appointment.payments.length,
    collected: moneyCode(collected, currency),
    outstanding: moneyCode(outstanding, currency),
    currency,
  };
}

/**
 * Edit an appointment's booked fields: client, service, staff, time, price,
 * notes. End time recomputes from the (possibly new) service's duration.
 *
 * Deliberately does NOT touch: payments (collected money is independent), the
 * hold ladder (holds are firmed/released through their own flow), or status
 * (that's updateAppointmentStatus). Overlaps are allowed on edit — a client can
 * process under the dryer while the next begins; only firming a hold blocks on
 * a committed clash (docs/HOLDS.md).
 */
export async function updateAppointment(input: {
  businessSlug: string;
  appointmentId: string;
  customer: string;
  service: string;
  staffMemberId: string;
  startAtLocal: string;
  price: number | null;
  notes: string;
}): Promise<AppointmentWriteResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Database not configured" };

  const appointment = await prisma.appointment.findFirst({
    where: { id: input.appointmentId, business: { slug: input.businessSlug } },
    include: { business: { select: { id: true, timezone: true } } },
  });
  if (!appointment) return { ok: false, error: "That appointment no longer exists." };

  const tz = appointment.business.timezone || "UTC";
  const startAt = fromLocalInput(input.startAtLocal, tz);
  if (!startAt) return { ok: false, error: "Enter a valid date and time." };

  const staff = await prisma.staffMember.findFirst({
    where: { id: input.staffMemberId, businessId: appointment.business.id, status: "ACTIVE" },
    select: { id: true },
  });
  if (!staff) return { ok: false, error: "Choose an active staff member." };

  if (!input.customer.trim()) return { ok: false, error: "A client is required." };
  if (!input.service.trim()) return { ok: false, error: "A service is required." };

  const override = input.price != null && Number.isFinite(input.price) && input.price >= 0 ? input.price : undefined;
  const customerId = await findOrCreateCustomer(appointment.business.id, input.customer);
  const svc = await findOrCreateService(appointment.business.id, input.service, override);
  if (!customerId || !svc) return { ok: false, error: "Couldn't resolve the client or service." };

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      customerId,
      serviceId: svc.id,
      staffMemberId: staff.id,
      startAt,
      endAt: addMinutes(startAt, svc.durationMinutes),
      price: override != null ? override : svc.price,
      notes: input.notes.trim() || null,
    },
  });

  return { ok: true };
}

/**
 * Hard delete, permitted only for an appointment with no payments.
 *
 * A booking with money against it is part of the financial record — deleting it
 * would orphan the payments and rewrite history. Cancelling (a status change
 * that keeps the row) is the honest action there. Guard lives here, not the UI.
 */
export async function deleteAppointment(businessSlug: string, appointmentId: string): Promise<AppointmentWriteResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Database not configured" };

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, business: { slug: businessSlug } },
    select: { id: true, _count: { select: { payments: true } } },
  });
  if (!appointment) return { ok: false, error: "That appointment no longer exists." };

  if (appointment._count.payments > 0) {
    return {
      ok: false,
      error: "This appointment has payments against it. Cancel it instead — deleting would erase that financial record.",
    };
  }

  await prisma.appointment.delete({ where: { id: appointment.id } });
  return { ok: true };
}

/**
 * Adjust a hold's expiry and queue position. Only meaningful for a HOLD; refuses
 * on a committed booking. Priority is a manual reorder within the contended slot
 * — see docs/HOLDS.md. Firming/releasing stay separate actions.
 */
export async function updateHoldSettings(input: {
  businessSlug: string;
  appointmentId: string;
  holdExpiresAt: Date | null;
  holdPriority: number | null;
}): Promise<AppointmentWriteResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Database not configured" };

  const hold = await prisma.appointment.findFirst({
    where: { id: input.appointmentId, business: { slug: input.businessSlug } },
    select: { id: true, status: true },
  });
  if (!hold) return { ok: false, error: "That hold no longer exists." };
  if (hold.status !== "HOLD") return { ok: false, error: "This booking isn't a hold." };

  if (input.holdPriority != null && input.holdPriority < 1) {
    return { ok: false, error: "Queue position must be 1 or higher." };
  }

  await prisma.appointment.update({
    where: { id: hold.id },
    data: {
      holdExpiresAt: input.holdExpiresAt,
      holdPriority: input.holdPriority,
    },
  });
  return { ok: true };
}
