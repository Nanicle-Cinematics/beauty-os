import "server-only";

import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { incomingWhere, refundWhere, bookingPaymentsWhere, collected, outstanding, depositDue } from "@/lib/money";
import type { BadgeTone } from "@/components/ui";
import {
  daysBetween,
  formatDayMonthInTz,
  formatLongDateInTz,
  formatTimeInTz,
  zonedDayRange,
} from "@/lib/date";

export type DashStat = {
  label: string;
  value: string;
  detail: string;
  tone: "rose" | "teal" | "blue" | "amber";
};

/** Context-aware headline. Generated from today's state, never hardcoded. */
export type HeroLine = { headline: string; sub: string };

/**
 * A pulse bar states what it measures. A bare percentage is unreadable — "50%"
 * of what? `detail` carries the figure the percentage came from.
 */
export type PulseBar = { label: string; value: number; detail: string };

/** Ordered by how much it hurts to ignore. */
export type QueuePriority = "urgent" | "soon" | "watch";
export type QueueItem = {
  id: string;
  priority: QueuePriority;
  title: string;
  body: string;
  action: { label: string; path: string };
};

export type PayState = { label: string; tone: BadgeTone };

export type DashAppointment = {
  id: string;
  time: string;
  client: string;
  service: string;
  staff: string;
  status: string;
  value: string;
  /** Booked vs actually paid, per appointment. */
  pay: PayState;
};

/** Today, in order, with the holes between bookings made visible. */
export type TimelineEntry =
  | ({ kind: "appointment" } & DashAppointment)
  | { kind: "gap"; id: string; label: string; detail: string };
export type DashClientSignal = { name: string; tag: string; note: string; spend: string };
export type DashStaff = {
  name: string;
  role: string;
  bookedLabel: string;
  bookedPercent: number;
  revenue: string;
  color: string;
};
export type DashInventory = { item: string; stock: string; level: number };

export type TenantDashboardData = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    currency: string;
    planName: string;
    staffSeats: number;
    branchCount: number;
    automationStatus: string;
  };
  todayLabel: string;
  hero: HeroLine;
  /** Item-9 secondary signals — only rendered when they say something. */
  secondary: { freeCapacity: string; bookedValue: string; returningToday: number; busiest: string | null };
  stats: DashStat[];
  revenueTrend?: { label: string; value: number; display: string }[];
  pulse: PulseBar[];
  pills: string[];
  queue: QueueItem[];
  timeline: TimelineEntry[];
  appointments: DashAppointment[];
  clientSignals: DashClientSignal[];
  staff: DashStaff[];
  inventory: DashInventory[];
};

const STAFF_COLORS = ["bg-emerald-500", "bg-rose-500", "bg-blue-500", "bg-amber-500", "bg-violet-500"];
// Never on the schedule at all.
const OFF_SCHEDULE = new Set(["CANCELLED", "NO_SHOW"]);
// Provisional: a hold occupies the slot on screen but is not business yet, so it
// must never reach revenue, utilization, capacity or deposits. See docs/HOLDS.md.
const PROVISIONAL = new Set(["HOLD"]);
const REALISED = new Set(["COMPLETED", "CONFIRMED"]);

function currencySymbol(currency: string) {
  return currency === "GHS" ? "GH₵" : currency;
}

function money(amount: number, currency: string) {
  return `${currencySymbol(currency)} ${Math.round(amount).toLocaleString("en-US")}`;
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** "45 min" / "1 hr" / "4.5 hrs" — minutes read badly above an hour. */
function hoursLabel(minutes: number) {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const hours = m / 60;
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)} ${rounded === 1 ? "hr" : "hrs"}`;
}

/** 13 -> "1pm", 9 -> "9am", 12 -> "12pm", 24 -> "12am". */
function hourLabel(hour: number) {
  const h = ((hour % 24) + 24) % 24;
  const suffix = h < 12 ? "am" : "pm";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}${suffix}`;
}

export async function getTenantDashboardData(businessSlug: string): Promise<TenantDashboardData | null> {
  // No demo fallback. Returning fabricated numbers when the database is
  // unreachable is worse than failing: the page would look healthy while showing
  // another studio's invented takings. The caller renders notFound() instead —
  // matching calendar/finance/ai-insights.
  if (!isDatabaseConfigured()) {
    return null;
  }

  const business = await prisma.business.findUnique({
    where: { slug: businessSlug },
    include: {
      subscription: { include: { plan: true } },
      hours: true,
      _count: { select: { staff: true } },
    },
  });

  if (!business) {
    return null;
  }

  const currency = business.currency;
  const timeZone = business.timezone || "UTC";
  const now = new Date();
  const { start, end } = zonedDayRange(now, timeZone);

  const [
    todayAppointments,
    activeStaff,
    products,
    customers,
    repeatGroups,
    totalCustomers,
    incomingTodayAgg,
    refundTodayAgg,
    paidByCustomerGroups,
    refundByCustomerGroups,
    paidByAppointmentGroups,
    openHolds,
    waitlist,
  ] = await Promise.all([
    prisma.appointment.findMany({
      where: { businessId: business.id, startAt: { gte: start, lt: end } },
      orderBy: { startAt: "asc" },
      include: {
        customer: true,
        service: true,
        staffMember: { include: { user: true } },
      },
    }),
    prisma.staffMember.findMany({
      where: { businessId: business.id, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      include: { user: true },
    }),
    prisma.product.findMany({ where: { businessId: business.id } }),
    // Bounded read: the most recent clients, used to build the "client signals"
    // list and today's birthdays. The retention % below is computed exactly in
    // SQL (not from this capped list).
    prisma.customer.findMany({
      where: { businessId: business.id },
      take: 500,
      include: {
        appointments: { select: { status: true, price: true, startAt: true }, orderBy: { startAt: "desc" } },
      },
    }),
    // Exact retention: clients with 2+ real visits, over the full base. HOLD is
    // excluded — a provisional date is not a visit, and counting it would make
    // one-time clients look like repeats (docs/HOLDS.md).
    prisma.appointment.groupBy({ by: ["customerId"], _count: true, where: { businessId: business.id, status: { notIn: ["CANCELLED", "NO_SHOW", "HOLD"] } } }),
    prisma.customer.count({ where: { businessId: business.id } }),
    // Cash actually taken today, ranged on paidAt — when the money moved, not
    // when the appointment happens to sit on the calendar.
    prisma.payment.aggregate({ _sum: { amount: true }, where: incomingWhere(business.id, { from: start, to: end }) }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: refundWhere(business.id, { from: start, to: end }) }),
    // Per-client settlement, for the "owes you" signal below.
    prisma.payment.groupBy({ by: ["customerId"], _sum: { amount: true }, where: bookingPaymentsWhere(business.id) }),
    prisma.payment.groupBy({ by: ["customerId"], _sum: { amount: true }, where: refundWhere(business.id) }),
    // Paid per appointment — what makes "is this one settled?" answerable, and
    // therefore what makes the queue and the timeline's payment state real.
    prisma.payment.groupBy({ by: ["appointmentId"], _sum: { amount: true }, where: bookingPaymentsWhere(business.id) }),
    // Holds needing a decision (docs/HOLDS.md) and waitlist clients who could
    // take a free slot — both are queue items, not decoration.
    prisma.appointment.findMany({
      where: { businessId: business.id, status: "HOLD" },
      orderBy: { holdExpiresAt: "asc" },
      take: 20,
      select: { id: true, holdExpiresAt: true, startAt: true, customer: { select: { firstName: true, lastName: true } } },
    }),
    prisma.waitlistEntry.findMany({
      where: { businessId: business.id, status: "WAITING" },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: { id: true, customer: { select: { firstName: true, lastName: true } }, service: { select: { name: true } } },
    }),
  ]);

  const paidByCustomer = new Map(paidByCustomerGroups.map((g) => [g.customerId, Number(g._sum.amount ?? 0)]));
  const refundedByCustomer = new Map(refundByCustomerGroups.map((g) => [g.customerId, Number(g._sum.amount ?? 0)]));
  const paidByAppointment = new Map(
    paidByAppointmentGroups
      .filter((g): g is typeof g & { appointmentId: string } => g.appointmentId != null)
      .map((g) => [g.appointmentId, Number(g._sum.amount ?? 0)]),
  );

  /** What this specific booking still owes. */
  const owedOn = (a: { id: string; price: unknown }) => outstanding(Number(a.price), paidByAppointment.get(a.id) ?? 0);
  const payStateOf = (a: { id: string; price: unknown }): PayState => {
    const paid = paidByAppointment.get(a.id) ?? 0;
    const price = Number(a.price);
    if (price > 0 && paid >= price) return { label: "Paid", tone: "success" };
    if (paid > 0) return { label: `${money(paid, currency)} paid`, tone: "warning" };
    // Nothing paid — the 50% deposit is owed (money.ts). Every booking carries one.
    return { label: "Deposit due", tone: "danger" };
  };

  // --- today's schedule ---
  // Shown on the schedule (holds included — the slot is spoken for).
  const scheduleToday = todayAppointments.filter((appointment) => !OFF_SCHEDULE.has(appointment.status));
  // Everything that counts as business. Holds are excluded from all of it.
  const committedToday = scheduleToday.filter((appointment) => !PROVISIONAL.has(appointment.status));
  // Booked is NOT revenue. This single line previously summed appointment prices
  // and displayed the total as "Today revenue", so a full day of unpaid bookings
  // read as a full day of takings. Booked and collected are now separate, and a
  // status change (PENDING -> CONFIRMED -> COMPLETED) re-reads the same price
  // rather than adding it again. See src/lib/money.ts.
  const bookedToday = committedToday.reduce((sum, appointment) => sum + Number(appointment.price), 0);
  const collectedToday = collected(
    Number(incomingTodayAgg._sum.amount ?? 0),
    Number(refundTodayAgg._sum.amount ?? 0),
  );
  const outstandingToday = outstanding(bookedToday, collectedToday);
  const pendingToday = committedToday.filter((appointment) => appointment.status === "PENDING");
  const completedToday = todayAppointments.filter((appointment) => appointment.status === "COMPLETED");
  // Bookings still owing part of their 50% deposit (money.ts). Confirming a
  // booking auto-logs the deposit, so this is mostly pending bookings.
  const unpaidDeposits = committedToday.filter(
    (appointment) => depositDue(Number(appointment.price), paidByAppointment.get(appointment.id) ?? 0) > 0,
  );
  const nextUp = committedToday.find((appointment) => appointment.startAt > now);

  // --- retention (exact, from SQL aggregates) ---
  const repeatClients = repeatGroups.filter((g) => g._count >= 2).length;
  const retention = totalCustomers ? (repeatClients / totalCustomers) * 100 : 0;

  // --- birthdays today (match month + day in tz) ---
  const todayKey = formatDayMonthInTz(now, timeZone);
  const birthdaysToday = customers.filter(
    (customer) => customer.birthdate && formatDayMonthInTz(customer.birthdate, timeZone) === todayKey,
  );

  // --- inventory ---
  const lowStock = products.filter(
    (product) => product.reorderThreshold != null && Number(product.quantityOnHand) <= Number(product.reorderThreshold),
  );
  const inventory: DashInventory[] = [...products]
    .map((product) => {
      const qty = Number(product.quantityOnHand);
      const threshold = product.reorderThreshold != null ? Number(product.reorderThreshold) : qty || 1;
      return {
        item: product.name,
        stock: `${qty % 1 === 0 ? qty : qty.toFixed(1)} in stock`,
        level: clampPercent(threshold > 0 ? (qty / (threshold * 2)) * 100 : 100),
        ratio: threshold > 0 ? qty / threshold : Number.POSITIVE_INFINITY,
      };
    })
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 4)
    .map(({ item, stock, level }) => ({ item, stock, level }));

  // --- open minutes today (for capacity math) ---
  const weekdayIndex: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const todayDow = weekdayIndex[new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(now)] ?? 0;
  const todayHours = business.hours.find((entry) => entry.dayOfWeek === todayDow);
  const openMinutes = (() => {
    if (!todayHours || todayHours.isClosed || !todayHours.openTime || !todayHours.closeTime) {
      return 540; // sensible default 9h
    }
    const [oh, om] = todayHours.openTime.split(":").map(Number);
    const [ch, cm] = todayHours.closeTime.split(":").map(Number);
    return Math.max(60, ch * 60 + cm - (oh * 60 + om));
  })();

  // --- staff utilization ---
  const staff: DashStaff[] = activeStaff.map((member, index) => {
    const mine = committedToday.filter((appointment) => appointment.staffMemberId === member.id);
    const bookedMinutes = mine.reduce(
      (sum, appointment) => sum + Math.max(0, (appointment.endAt.getTime() - appointment.startAt.getTime()) / 60000),
      0,
    );
    const revenue = mine.reduce((sum, appointment) => sum + Number(appointment.price), 0);
    return {
      name: member.user?.name ?? member.invitedEmail ?? "Staff member",
      role: titleCase(member.role),
      bookedLabel: `${mine.length} today`,
      bookedPercent: clampPercent((bookedMinutes / openMinutes) * 100),
      revenue: money(revenue, currency),
      color: STAFF_COLORS[index % STAFF_COLORS.length],
    };
  });

  // --- client signals (prioritise birthday > owed > at-risk > top spender) ---
  const enrichedClients = customers.map((customer) => {
    const realisedVisits = customer.appointments.filter((appointment) => REALISED.has(appointment.status));
    // Spend is money handed over, not value booked. This previously summed
    // appointment prices, so a client who booked GH₵800 and paid nothing ranked
    // as the studio's top spender.
    const spend = collected(paidByCustomer.get(customer.id) ?? 0, refundedByCustomer.get(customer.id) ?? 0);
    const lastVisit = realisedVisits[0]?.startAt ?? null;
    return {
      name: [customer.firstName, customer.lastName].filter(Boolean).join(" "),
      spend,
      outstanding: outstanding(
        customer.appointments
          .filter((a) => REALISED.has(a.status))
          .reduce((sum, a) => sum + Number(a.price), 0),
        paidByCustomer.get(customer.id) ?? 0,
      ),
      isBirthday: customer.birthdate ? formatDayMonthInTz(customer.birthdate, timeZone) === todayKey : false,
      lastVisitDays: lastVisit ? daysBetween(lastVisit, now) : null,
      tags: customer.tags,
      note: customer.skinNotes || customer.allergies || null,
    };
  });

  const signalScore = (client: (typeof enrichedClients)[number]) => {
    if (client.isBirthday) return 4;
    if (client.outstanding > 0) return 3;
    if (client.lastVisitDays != null && client.lastVisitDays > 45) return 2;
    return client.spend > 0 ? 1 : 0;
  };

  const clientSignals: DashClientSignal[] = [...enrichedClients]
    .sort((a, b) => signalScore(b) - signalScore(a) || b.spend - a.spend)
    .slice(0, 3)
    .map((client) => {
      let tag = client.tags[0] ?? "client";
      let note = client.note ?? "No notes yet";
      if (client.isBirthday) {
        tag = "birthday";
        note = "Birthday today — send a treat";
      } else if (client.outstanding > 0) {
        tag = "owes";
        note = `Outstanding ${money(client.outstanding, currency)}`;
      } else if (client.lastVisitDays != null && client.lastVisitDays > 45) {
        tag = "at risk";
        note = `No visit in ${client.lastVisitDays} days`;
      }
      return { name: client.name, tag, note, spend: money(client.spend, currency) };
    });

  // --- headline stats ---
  // "Booked today" and "Collected today" are deliberately separate tiles. The
  // old single "Today revenue" tile showed booked value under a cash label, so a
  // day of unpaid bookings read as a day of takings.
  const stats: DashStat[] = [
    {
      label: "Booked today",
      value: money(bookedToday, currency),
      detail: outstandingToday > 0
        ? `${money(outstandingToday, currency)} still to collect`
        : `${committedToday.length} booked ${committedToday.length === 1 ? "service" : "services"}`,
      tone: "rose",
    },
    {
      label: "Collected today",
      value: money(collectedToday, currency),
      detail: bookedToday > 0
        ? `${clampPercent((collectedToday / bookedToday) * 100)}% of today's booked value`
        : "Payments received today",
      tone: "teal",
    },
    {
      label: "Bookings today",
      value: String(committedToday.length),
      detail: pendingToday.length ? `${pendingToday.length} pending confirmation` : "All confirmed",
      tone: "teal",
    },
    {
      label: "Client retention",
      value: `${Math.round(retention)}%`,
      detail: `${repeatClients} of ${customers.length} are repeat`,
      tone: "blue",
    },
    {
      label: "Inventory alerts",
      value: String(lowStock.length),
      detail: lowStock.length ? "below reorder point" : "stock healthy",
      tone: "amber",
    },
  ];

  // --- studio pulse ---
  // Each bar now states what it measures. "Bookings" previously divided today's
  // count by a fabricated `staff × 6` ceiling, so the number meant nothing.
  const realisedToday = committedToday.filter((a) => REALISED.has(a.status));
  const bookedMinutesToday = committedToday.reduce(
    (sum, a) => sum + Math.max(0, (a.endAt.getTime() - a.startAt.getTime()) / 60000),
    0,
  );
  const capacityMinutes = Math.max(1, activeStaff.length * openMinutes);
  // Fully settled means paid, not merely marked complete.
  const paidCompleted = completedToday.filter((a) => owedOn(a) === 0);

  const pulse: PulseBar[] = [
    {
      label: "Bookings",
      value: clampPercent(committedToday.length ? (realisedToday.length / committedToday.length) * 100 : 0),
      detail: committedToday.length
        ? `${realisedToday.length} of ${committedToday.length} confirmed`
        : "No bookings today",
    },
    {
      label: "Capacity",
      value: clampPercent((bookedMinutesToday / capacityMinutes) * 100),
      detail: `${hoursLabel(bookedMinutesToday)} of ${hoursLabel(capacityMinutes)} booked`,
    },
    {
      label: "Checkout",
      value: clampPercent(completedToday.length ? (paidCompleted.length / completedToday.length) * 100 : 0),
      detail: completedToday.length
        ? `${paidCompleted.length} of ${completedToday.length} paid in full`
        : "Nothing completed yet",
    },
  ];

  const pills = [
    nextUp ? `Next: ${formatTimeInTz(nextUp.startAt, timeZone)}` : "No more bookings today",
    `${unpaidDeposits.length} unpaid ${unpaidDeposits.length === 1 ? "deposit" : "deposits"}`,
    `${birthdaysToday.length} ${birthdaysToday.length === 1 ? "birthday" : "birthdays"} today`,
  ];

  // --- front desk queue ---
  // Real decisions, ranked by how much it costs to ignore them. This replaced a
  // list of strings rendered with a checkbox that did nothing.
  const queue: QueueItem[] = [];
  const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

  // Money about to walk out of the door: starts within 3h, still owes.
  const startingSoonUnpaid = committedToday.filter(
    (a) => a.startAt > now && a.startAt.getTime() - now.getTime() <= 3 * 60 * 60 * 1000 && owedOn(a) > 0,
  );
  if (startingSoonUnpaid.length) {
    const total = startingSoonUnpaid.reduce((sum, a) => sum + owedOn(a), 0);
    queue.push({
      id: "starting-soon-unpaid",
      priority: "urgent",
      title: `${startingSoonUnpaid.length} ${plural(startingSoonUnpaid.length, "booking")} starting soon with money owing`,
      body: `${money(total, currency)} is unpaid on ${plural(startingSoonUnpaid.length, "an appointment", "appointments")} due within the next three hours. Take payment at check-in.`,
      action: { label: "Take payment", path: "payments" },
    });
  }

  // Already served, never paid — the most expensive kind of gap.
  const missedCheckout = completedToday.filter((a) => owedOn(a) > 0);
  if (missedCheckout.length) {
    const total = missedCheckout.reduce((sum, a) => sum + owedOn(a), 0);
    queue.push({
      id: "missed-checkout",
      priority: "urgent",
      title: `${missedCheckout.length} completed ${plural(missedCheckout.length, "service")} left unpaid`,
      body: `${money(total, currency)} was served today but never collected. Chase it before the client leaves.`,
      action: { label: "Record payment", path: "payments" },
    });
  }

  if (unpaidDeposits.length) {
    const total = unpaidDeposits.reduce((sum, a) => sum + Number(a.depositAmount ?? 0), 0);
    queue.push({
      id: "unpaid-deposits",
      priority: "urgent",
      title: `${unpaidDeposits.length} unpaid ${plural(unpaidDeposits.length, "deposit")}`,
      body: `${money(total, currency)} of deposits is uncollected on today's book. Deposits are what stop no-shows.`,
      action: { label: "Collect deposits", path: "payments" },
    });
  }

  if (pendingToday.length) {
    queue.push({
      id: "unconfirmed",
      priority: "soon",
      title: `${pendingToday.length} ${plural(pendingToday.length, "booking")} still unconfirmed`,
      body: "An unconfirmed booking is a slot you can neither rely on nor resell. Confirm or release it.",
      action: { label: "Confirm bookings", path: "appointments" },
    });
  }

  // Holds are provisional and expire silently (docs/HOLDS.md).
  const expiredHolds = openHolds.filter((h) => h.holdExpiresAt != null && h.holdExpiresAt < now);
  const expiringHolds = openHolds.filter(
    (h) => h.holdExpiresAt != null && h.holdExpiresAt >= now && h.holdExpiresAt.getTime() - now.getTime() <= 3 * DAY,
  );
  if (expiredHolds.length || expiringHolds.length) {
    const expired = expiredHolds.length > 0;
    const n = expired ? expiredHolds.length : expiringHolds.length;
    queue.push({
      id: "holds",
      priority: expired ? "soon" : "watch",
      title: expired
        ? `${n} ${plural(n, "hold")} ${n === 1 ? "has" : "have"} expired`
        : `${n} ${plural(n, "hold")} ${n === 1 ? "expires" : "expire"} within 3 days`,
      body: expired
        ? "These dates are still blocked but nobody has committed. Confirm them or release the slots."
        : "Chase the client to confirm, or release the date so someone else can take it.",
      action: { label: "Review holds", path: "appointments" },
    });
  }

  // Someone is waiting, and there is room today.
  if (waitlist.length && bookedMinutesToday < capacityMinutes) {
    const first = waitlist[0];
    const who = [first.customer.firstName, first.customer.lastName].filter(Boolean).join(" ");
    queue.push({
      id: "waitlist",
      priority: "watch",
      title: `${waitlist.length} ${plural(waitlist.length, "client")} waiting for a slot`,
      body: `${who} is first in line for ${first.service?.name ?? "a service"}, and you still have ${hoursLabel(capacityMinutes - bookedMinutesToday)} free today.`,
      action: { label: "Open waitlist", path: "waitlist" },
    });
  }

  if (lowStock.length) {
    const names = lowStock.slice(0, 2).map((p) => p.name).join(" and ");
    queue.push({
      id: "low-stock",
      priority: "watch",
      title: `${names}${lowStock.length > 2 ? ` and ${lowStock.length - 2} more` : ""} ${lowStock.length === 1 ? "is" : "are"} low`,
      body: committedToday.length
        ? "Running out mid-service forces a reschedule. Reorder before it affects today's book."
        : "Reorder before it starts costing you bookings.",
      action: { label: "View inventory", path: "inventory" },
    });
  }

  const atRisk = enrichedClients.find((client) => client.lastVisitDays != null && client.lastVisitDays > 45);
  if (atRisk && queue.length < 6) {
    queue.push({
      id: "at-risk-client",
      priority: "watch",
      title: `${atRisk.name} hasn't been in for ${atRisk.lastVisitDays} days`,
      body: "Regulars slip away quietly. A short message now is cheaper than winning them back later.",
      action: { label: "View clients", path: "clients" },
    });
  }

  const PRIORITY_ORDER: Record<QueuePriority, number> = { urgent: 0, soon: 1, watch: 2 };
  queue.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  // Returning clients in today's chair — free, from the retention groups already
  // fetched. A client with 2+ real visits has been here before.
  const visitCounts = new Map(repeatGroups.map((g) => [g.customerId, g._count]));
  const returningToday = new Set(
    committedToday.filter((a) => (visitCounts.get(a.customerId) ?? 0) >= 2).map((a) => a.customerId),
  ).size;

  const toDashAppointment = (appointment: (typeof scheduleToday)[number]): DashAppointment => ({
    id: appointment.id,
    time: formatTimeInTz(appointment.startAt, timeZone),
    client: [appointment.customer.firstName, appointment.customer.lastName].filter(Boolean).join(" "),
    service: appointment.service.name,
    staff: appointment.staffMember?.user?.name ?? appointment.staffMember?.invitedEmail ?? "Unassigned",
    status: titleCase(appointment.status),
    value: money(Number(appointment.price), currency),
    pay: payStateOf(appointment),
  });

  const appointments: DashAppointment[] = scheduleToday.slice(0, 6).map(toDashAppointment);

  // --- today timeline ---
  // What's left of today, in order, with the holes made visible. A gap is only
  // worth showing if it's sellable — a 10-minute turnaround is not a free slot.
  const MIN_SELLABLE_GAP = 30;
  const remaining = scheduleToday.filter((a) => a.endAt > now).slice(0, 8);
  const timeline: TimelineEntry[] = [];
  let cursor = now;

  for (const appointment of remaining) {
    const gapMinutes = Math.round((appointment.startAt.getTime() - cursor.getTime()) / 60000);
    if (gapMinutes >= MIN_SELLABLE_GAP) {
      timeline.push({
        kind: "gap",
        id: `gap-${appointment.id}`,
        label: `${hoursLabel(gapMinutes)} free`,
        detail: `${formatTimeInTz(cursor, timeZone)} – ${formatTimeInTz(appointment.startAt, timeZone)}`,
      });
    }
    timeline.push({ kind: "appointment", ...toDashAppointment(appointment) });
    if (appointment.endAt > cursor) cursor = appointment.endAt;
  }

  // --- busiest stretch ---
  // The run of hours carrying the most simultaneous work, in the business's own
  // timezone. Only meaningful once something actually overlaps, so a day of
  // scattered singles reports nothing rather than inventing a "peak".
  const busiestWindow = (() => {
    if (committedToday.length < 2) return null;
    const hourIn = (d: Date) =>
      Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hour12: false }).format(d));

    const load = new Map<number, number>();
    for (const a of committedToday) {
      const from = hourIn(a.startAt);
      // -1ms so an appointment ending exactly on the hour doesn't claim it.
      const to = hourIn(new Date(Math.max(a.startAt.getTime(), a.endAt.getTime() - 1)));
      for (let h = from; h <= to; h++) load.set(h, (load.get(h) ?? 0) + 1);
    }

    const peak = Math.max(...load.values());
    if (peak < 2) return null;
    const hours = [...load.entries()].filter(([, n]) => n === peak).map(([h]) => h).sort((a, b) => a - b);
    return `${hourLabel(hours[0])}–${hourLabel(hours[hours.length - 1] + 1)}`;
  })();

  // --- hero ---
  // Generated from the state of the day. Previously a fixed sentence that said
  // the same thing to a fully-booked studio and an empty one.
  const freeMinutes = Math.max(0, capacityMinutes - bookedMinutesToday);
  const hero: HeroLine = (() => {
    if (committedToday.length === 0) {
      return {
        headline: "A clear day — room to fill.",
        sub: waitlist.length
          ? `Nothing booked yet, and ${waitlist.length} ${plural(waitlist.length, "client")} on your waitlist.`
          : `No bookings today for ${business.name}. A good moment to chase deposits or reach out to lapsing clients.`,
      };
    }

    const owedToday = committedToday.reduce((sum, a) => sum + owedOn(a), 0);
    if (owedToday > 0 && (startingSoonUnpaid.length || missedCheckout.length || unpaidDeposits.length)) {
      return {
        headline: `${money(owedToday, currency)} on today's book is unpaid.`,
        sub: `${committedToday.length} ${plural(committedToday.length, "booking")} today · ${money(collectedToday, currency)} collected so far.`,
      };
    }

    if (freeMinutes < MIN_SELLABLE_GAP) {
      return {
        headline: "Today is fully booked.",
        sub: `${committedToday.length} ${plural(committedToday.length, "booking")} across ${activeStaff.length} ${plural(activeStaff.length, "team member")} · ${money(bookedToday, currency)} booked.`,
      };
    }

    return {
      headline: `${committedToday.length} ${plural(committedToday.length, "booking")} today with ${hoursLabel(freeMinutes)} still open.`,
      sub: busiestWindow
        ? `Your busiest stretch is ${busiestWindow}. ${money(bookedToday, currency)} booked, ${money(collectedToday, currency)} collected.`
        : `${money(bookedToday, currency)} booked, ${money(collectedToday, currency)} collected.`,
    };
  })();

  // 6-week revenue trend for the dashboard mini chart.
  const DAY = 24 * 60 * 60 * 1000;
  const trendBounds = Array.from({ length: 6 }, (_unused, idx) => {
    const i = 5 - idx;
    return { label: i === 0 ? "Now" : `${i}w`, start: new Date(now.getTime() - (i + 1) * 7 * DAY), end: new Date(now.getTime() - i * 7 * DAY) };
  });
  const revTrendAggs = await Promise.all(
    trendBounds.map((b) =>
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { businessId: business.id, status: "SUCCESS", type: { not: "REFUND" }, createdAt: { gte: b.start, lt: b.end } },
      }),
    ),
  );
  const revenueTrend = trendBounds.map((b, i) => {
    const v = Number(revTrendAggs[i]._sum.amount ?? 0);
    return { label: b.label, value: v, display: money(v, currency) };
  });

  return {
    tenant: {
      id: business.id,
      name: business.name,
      slug: business.slug,
      currency,
      planName: business.subscription?.plan.name ?? "No plan",
      staffSeats: business._count.staff,
      branchCount: 1,
      automationStatus: business.status === "TRIAL" ? "trial reminders active" : "automated reminders active",
    },
    todayLabel: formatLongDateInTz(now, timeZone),
    stats,
    revenueTrend,
    pulse,
    hero,
    secondary: {
      freeCapacity: hoursLabel(freeMinutes),
      bookedValue: money(bookedToday, currency),
      returningToday,
      busiest: busiestWindow,
    },
    pills,
    queue,
    timeline,
    appointments,
    clientSignals,
    staff,
    inventory,
  };
}
