import "server-only";

import { addMinutes, formatLongDateInTz, formatTimeInTz, toLocalInput, fromLocalInput } from "@/lib/date";
import { prisma, tenantTransaction, isDatabaseConfigured } from "@/lib/prisma";
import { findOrCreateCustomer, findOrCreateService } from "@/lib/entity-resolve";
import { depositTarget } from "@/lib/money";
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
  dateKey: string;
  dateLabel: string;
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
  invoice: { id: string; number: string } | null;
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
    categoryKey: string;
  };
  defaultStartAtLocal: string;
  appointments: AppointmentRow[];
  customers: AppointmentOption[];
  services: AppointmentOption[];
  staff: AppointmentOption[];
};

const fallbackAppointmentData: Record<string, AppointmentModuleData> = {
  "osu-glow-studio": {
    tenant: { id: "sample_osu_glow", name: "Osu Glow Studio", slug: "osu-glow-studio", categoryKey: "hair_makeup_nails" },
    appointments: [
      { id: "demo-1", dateKey: "today", dateLabel: "Today", time: "09:00", client: "Ama Serwaa", service: "Silk press + trim", staff: "Nadia", status: "CONFIRMED", value: "GH₵ 420", isHold: false, holdExpired: false, holdExpiryLabel: null, holdQueueLabel: null },
      { id: "demo-2", dateKey: "today", dateLabel: "Today", time: "10:30", client: "Esi Manu", service: "Soft glam", staff: "Nadia", status: "PENDING", value: "GH₵ 650", isHold: false, holdExpired: false, holdExpiryLabel: null, holdQueueLabel: null },
      { id: "demo-3", dateKey: "today", dateLabel: "Today", time: "12:00", client: "Akua Mensah", service: "Wig install", staff: "Nadia", status: "Hold", value: "GH₵ 780", isHold: true, holdExpired: false, holdExpiryLabel: "expires in 3 days", holdQueueLabel: null },
    ],
    defaultStartAtLocal: "2026-07-13T14:00",
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
    tenant: { id: "sample_luxe_lash", name: "Luxe Lash Lab", slug: "luxe-lash-lab", categoryKey: "lashes_brows" },
    appointments: [
      { id: "demo-4", dateKey: "today", dateLabel: "Today", time: "09:00", client: "Yaa Boateng", service: "Classic lash set", staff: "Mina", status: "CONFIRMED", value: "GH₵ 360", isHold: false, holdExpired: false, holdExpiryLabel: null, holdQueueLabel: null },
      { id: "demo-5", dateKey: "today", dateLabel: "Today", time: "11:30", client: "Afia Owusu", service: "Brow lamination", staff: "Mina", status: "PENDING", value: "GH₵ 220", isHold: false, holdExpired: false, holdExpiryLabel: null, holdQueueLabel: null },
    ],
    defaultStartAtLocal: "2026-07-13T14:00",
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

function dayLabel(date: Date, timezone: string) {
  return formatLongDateInTz(date, timezone);
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

type EmailBusiness = { id: string; name: string; phone: string | null; email: string | null; timezone: string };

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
    businessEmail: business.email,
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
    select: { id: true, name: true, slug: true, currency: true, timezone: true, category: { select: { key: true } } },
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
  const timezone = business.timezone || "UTC";
  const nextHour = new Date(now);
  nextHour.setMinutes(0, 0, 0);
  nextHour.setHours(nextHour.getHours() + 1);

  return {
    tenant: { id: business.id, name: business.name, slug: business.slug, categoryKey: business.category.key },
    defaultStartAtLocal: toLocalInput(nextHour, timezone),
    appointments: appointments.map((appointment) => {
      const isHold = appointment.status === "HOLD";
      const dateKey = toLocalInput(appointment.startAt, timezone).slice(0, 10);
      return {
        id: appointment.id,
        dateKey,
        dateLabel: dayLabel(appointment.startAt, timezone),
        time: formatTimeInTz(appointment.startAt, timezone),
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

  const resolvedPrice = override != null ? override : Number(svc.price);

  await tenantTransaction(
    async (tx) => {
      await tx.appointment.create({
        data: {
          businessId: business.id,
          customerId,
          serviceId: svc.id,
          staffMemberId: staffMember.id,
          startAt,
          endAt,
          status: hold ? "HOLD" : "PENDING",
          source: "ADMIN",
          price: resolvedPrice,
          // Deposit is no longer a stored per-service amount — it's 50% of price,
          // computed (money.ts). This column is retired; kept only until dropped
          // in its own migration.
          depositAmount: null,
          depositPaid: false,
          holdExpiresAt: hold ? (holdExpiresAt ?? defaultHoldExpiry(startAt)) : null,
          holdPriority,
        },
        select: { id: true },
      });
      // New bookings start pending. Money is only recorded when staff explicitly
      // confirms the booking, which is the point the 50% deposit is received.
    },
    { timeout: 15000 },
  );
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
      customerId: true,
      price: true,
      business: { select: { id: true, name: true, phone: true, email: true, timezone: true } },
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
      await autoSettle(tx, appointment, "deposit");

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
      business: { select: { id: true, name: true, phone: true, email: true, timezone: true } },
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

/** SUCCESS booking-payments in, minus refunds, for one appointment. */
async function netPaidOnAppointment(
  tx: { payment: { aggregate: typeof prisma.payment.aggregate } },
  appointmentId: string,
): Promise<number> {
  const [paidAgg, refundAgg] = await Promise.all([
    tx.payment.aggregate({
      _sum: { amount: true },
      where: { appointmentId, status: "SUCCESS", type: { in: ["DEPOSIT", "FULL_PAYMENT", "BALANCE"] } },
    }),
    tx.payment.aggregate({ _sum: { amount: true }, where: { appointmentId, status: "SUCCESS", type: "REFUND" } }),
  ]);
  return Number(paidAgg._sum.amount ?? 0) - Number(refundAgg._sum.amount ?? 0);
}

/**
 * Auto-record a payment when a booking is confirmed or completed, per the 50%
 * deposit policy (money.ts). It logs only the SHORTFALL to the goal, so it can
 * never over-count:
 *   - confirm  → top up to the 50% deposit  (goal = depositTarget)
 *   - complete → top up to the full price   (goal = price)
 * If the goal is already met, it logs nothing — so re-confirming or re-completing
 * is a no-op, and a deposit taken on confirm means completion only logs the
 * remaining balance, never another full charge. Method defaults to cash; staff
 * can correct it on the payment afterward.
 */
async function autoSettle(
  tx: Parameters<Parameters<typeof tenantTransaction>[0]>[0],
  appointment: { id: string; businessId: string; customerId: string; price: unknown },
  kind: "deposit" | "full",
) {
  const price = Number(appointment.price);
  if (!(price > 0)) return;
  const paid = await netPaidOnAppointment(tx, appointment.id);
  const goal = kind === "deposit" ? depositTarget(price) : price;
  const delta = Math.round((goal - paid) * 100) / 100;
  if (delta <= 0) return; // goal already met — idempotent

  await tx.payment.create({
    data: {
      businessId: appointment.businessId,
      customerId: appointment.customerId,
      appointmentId: appointment.id,
      amount: delta,
      method: "CASH",
      // A completion with nothing paid yet is a full payment; with a prior
      // deposit it's the balance.
      type: kind === "deposit" ? "DEPOSIT" : paid > 0 ? "BALANCE" : "FULL_PAYMENT",
      status: "SUCCESS",
      note: kind === "deposit" ? "Auto-recorded: 50% deposit on confirm" : "Auto-recorded on completion",
      paidAt: new Date(),
    },
  });
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

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, business: { slug: businessSlug } },
    select: { id: true, businessId: true, customerId: true, price: true },
  });
  if (!appointment) return;

  // Status change and its auto-payment are one transaction — the books can never
  // reflect a confirmed/completed booking without its recorded payment, or vice
  // versa.
  await tenantTransaction(
    async (tx) => {
      await tx.appointment.update({
        where: { id: appointment.id },
        data: { status, cancelledAt: status === "CANCELLED" ? new Date() : null },
      });
      if (status === "CONFIRMED") await autoSettle(tx, appointment, "deposit");
      else if (status === "COMPLETED") await autoSettle(tx, appointment, "full");
    },
    { timeout: 15000 },
  );
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
      invoices: { select: { id: true, invoiceNumber: true }, orderBy: { issuedAt: "desc" }, take: 1 },
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
    // Deposit is 50% of price (money.ts), computed — the stored column is retired.
    depositAmount: String(depositTarget(Number(appointment.price))),
    notes: appointment.notes ?? "",
    isHold: appointment.status === "HOLD",
    holdExpiresAtLocal: appointment.holdExpiresAt ? appointment.holdExpiresAt.toISOString().slice(0, 10) : "",
    holdPriority: appointment.holdPriority != null ? String(appointment.holdPriority) : "",
    paymentCount: appointment.payments.length,
    invoice: appointment.invoices[0] ? { id: appointment.invoices[0].id, number: appointment.invoices[0].invoiceNumber } : null,
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
 * Delete a booking and its payments together, in one transaction.
 *
 * For a booking recorded in error. Pending bookings usually have no payments;
 * confirmed/completed bookings may carry deposits or balances. We delete any
 * linked payments alongside the booking and return what was removed, so the
 * action can write it to the audit trail. To reverse a booking where real cash
 * was taken, the honest path is Cancel (keeps the row) + a refund.
 */
export async function deleteAppointment(
  businessSlug: string,
  appointmentId: string,
): Promise<{ ok: true; removedPayments: number; removedTotal: number } | { ok: false; error: string }> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Database not configured" };

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, business: { slug: businessSlug } },
    select: { id: true, payments: { select: { amount: true, type: true, status: true } } },
  });
  if (!appointment) return { ok: false, error: "That appointment no longer exists." };

  const removedPayments = appointment.payments.length;
  let removedTotal = 0;
  for (const p of appointment.payments) {
    if (p.status !== "SUCCESS") continue;
    if (p.type === "REFUND") removedTotal -= Number(p.amount);
    else if (["DEPOSIT", "FULL_PAYMENT", "BALANCE", "PRODUCT_SALE"].includes(p.type)) removedTotal += Number(p.amount);
  }

  await tenantTransaction(
    async (tx) => {
      await tx.payment.deleteMany({ where: { appointmentId: appointment.id } });
      await tx.appointment.delete({ where: { id: appointment.id } });
    },
    { timeout: 15000 },
  );

  return { ok: true, removedPayments, removedTotal };
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
