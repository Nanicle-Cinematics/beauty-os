import "server-only";

import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { incomingWhere, refundWhere, bookingPaymentsWhere, collected, outstanding, depositDue } from "@/lib/money";
import type { BadgeTone } from "@/components/ui";
import {
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
  aiGuidePrompt?: {
    show: boolean;
    title: string;
    body: string;
    action: { label: string; path: string };
  };
};

// Never on the schedule at all.
const OFF_SCHEDULE = new Set(["CANCELLED", "NO_SHOW"]);
// Provisional: a hold occupies the slot on screen but is not business yet, so it
// must never reach revenue, utilization, capacity or deposits. See docs/HOLDS.md.
const PROVISIONAL = new Set(["HOLD"]);

const fallbackDashboards: Record<string, TenantDashboardData> = {
  "osu-glow-studio": {
    tenant: {
      id: "sample_osu_glow",
      name: "Osu Glow Studio",
      slug: "osu-glow-studio",
      currency: "GHS",
      planName: "Studio Pro",
      staffSeats: 6,
      branchCount: 1,
      automationStatus: "automated reminders active",
    },
    todayLabel: formatLongDateInTz(new Date(), "Africa/Accra"),
    hero: {
      headline: "3 bookings today with 4.5 hrs still open.",
      sub: "GH₵ 1,850 booked, GH₵ 535 collected. One hold needs a decision before the slot goes cold.",
    },
    secondary: { freeCapacity: "4.5 hrs", bookedValue: "GH₵ 1,850", returningToday: 2, busiest: "10am–1pm" },
    stats: [
      { label: "Booked today", value: "GH₵ 1,850", detail: "GH₵ 1,315 still to collect", tone: "rose" },
      { label: "Collected today", value: "GH₵ 535", detail: "29% of today's booked value", tone: "teal" },
      { label: "Bookings today", value: "3", detail: "1 pending confirmation", tone: "teal" },
      { label: "Client retention", value: "68%", detail: "42 of 62 are repeat", tone: "blue" },
    ],
    revenueTrend: [
      { label: "5w", value: 4200, display: "GH₵ 4,200" },
      { label: "4w", value: 5100, display: "GH₵ 5,100" },
      { label: "3w", value: 4700, display: "GH₵ 4,700" },
      { label: "2w", value: 6200, display: "GH₵ 6,200" },
      { label: "1w", value: 5900, display: "GH₵ 5,900" },
      { label: "Now", value: 6800, display: "GH₵ 6,800" },
    ],
    pulse: [
      { label: "Bookings", value: 67, detail: "2 of 3 confirmed" },
      { label: "Capacity", value: 54, detail: "4.5 hrs of 8.5 hrs booked" },
      { label: "Checkout", value: 50, detail: "1 of 2 paid in full" },
    ],
    pills: ["Next: 10:30", "2 unpaid deposits", "1 birthday today"],
    queue: [
      { id: "demo-deposits", priority: "urgent", title: "2 unpaid deposits", body: "GH₵ 715 of deposits is uncollected on today's book. Collect before check-in.", action: { label: "Collect deposits", path: "payments" } },
      { id: "demo-hold", priority: "watch", title: "1 hold expires within 3 days", body: "Akua's wig install is blocking a premium slot. Confirm it or release the date.", action: { label: "Review holds", path: "appointments" } },
      { id: "demo-stock", priority: "watch", title: "Lace adhesive and setting spray are low", body: "Reorder before it affects this week's services.", action: { label: "View inventory", path: "inventory" } },
    ],
    timeline: [
      { kind: "appointment", id: "demo-1", time: "09:00", client: "Ama Serwaa", service: "Silk press + trim", staff: "Nadia", status: "Confirmed", value: "GH₵ 420", pay: { label: "Paid", tone: "success" } },
      { kind: "appointment", id: "demo-2", time: "10:30", client: "Esi Manu", service: "Soft glam", staff: "Nadia", status: "Pending", value: "GH₵ 650", pay: { label: "Deposit due", tone: "danger" } },
      { kind: "gap", id: "demo-gap", label: "1.5 hrs free", detail: "12:00 – 1:30" },
      { kind: "appointment", id: "demo-3", time: "12:00", client: "Akua Mensah", service: "Wig install", staff: "Nadia", status: "Hold", value: "GH₵ 780", pay: { label: "Deposit due", tone: "danger" } },
    ],
    appointments: [
      { id: "demo-1", time: "09:00", client: "Ama Serwaa", service: "Silk press + trim", staff: "Nadia", status: "Confirmed", value: "GH₵ 420", pay: { label: "Paid", tone: "success" } },
      { id: "demo-2", time: "10:30", client: "Esi Manu", service: "Soft glam", staff: "Nadia", status: "Pending", value: "GH₵ 650", pay: { label: "Deposit due", tone: "danger" } },
      { id: "demo-3", time: "12:00", client: "Akua Mensah", service: "Wig install", staff: "Nadia", status: "Hold", value: "GH₵ 780", pay: { label: "Deposit due", tone: "danger" } },
    ],
    clientSignals: [
      { name: "Ama Serwaa", tag: "top spender", note: "Prefers early weekday slots", spend: "GH₵ 3,420" },
      { name: "Esi Manu", tag: "owes", note: "Outstanding GH₵ 325", spend: "GH₵ 1,950" },
      { name: "Akua Mensah", tag: "birthday", note: "Birthday today — send a treat", spend: "GH₵ 2,180" },
    ],
    staff: [
      { name: "Nadia Mensah", role: "Owner", bookedLabel: "3 today", bookedPercent: 54, revenue: "GH₵ 1,850", color: "bg-emerald-500" },
      { name: "Mabel Addo", role: "Artist", bookedLabel: "1 today", bookedPercent: 28, revenue: "GH₵ 420", color: "bg-rose-500" },
    ],
    inventory: [
      { item: "Lace adhesive", stock: "2 in stock", level: 28 },
      { item: "Setting spray", stock: "3 in stock", level: 34 },
      { item: "Silk serum", stock: "9 in stock", level: 76 },
    ],
    aiGuidePrompt: {
      show: false,
      title: "AI setup guide",
      body: "Get a step-by-step setup guide and weekly forecast.",
      action: { label: "Open AI guide", path: "ai-insights" },
    },
  },
};

fallbackDashboards["luxe-lash-lab"] = {
  ...fallbackDashboards["osu-glow-studio"],
  tenant: {
    ...fallbackDashboards["osu-glow-studio"].tenant,
    id: "sample_luxe_lash",
    name: "Luxe Lash Lab",
    slug: "luxe-lash-lab",
    planName: "Growth Suite",
    staffSeats: 3,
    automationStatus: "trial reminders active",
  },
  hero: {
    headline: "2 bookings today with a refill slot open.",
    sub: "GH₵ 580 booked, GH₵ 180 collected. One brow appointment still needs confirmation.",
  },
  appointments: [
    { id: "demo-5", time: "09:00", client: "Yaa Boateng", service: "Classic lash set", staff: "Mina", status: "Confirmed", value: "GH₵ 360", pay: { label: "GH₵ 180 paid", tone: "warning" } },
    { id: "demo-6", time: "11:30", client: "Afia Owusu", service: "Brow lamination", staff: "Mina", status: "Pending", value: "GH₵ 220", pay: { label: "Deposit due", tone: "danger" } },
  ],
};

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
  if (!isDatabaseConfigured()) {
    return fallbackDashboards[businessSlug] ?? null;
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
  const DAY = 24 * 60 * 60 * 1000;
  const { start, end } = zonedDayRange(now, timeZone);

  const [
    todayAppointments,
    activeStaffCount,
    products,
    incomingTodayAgg,
    refundTodayAgg,
    paidByAppointmentGroups,
    openHolds,
    waitlist,
  ] = await Promise.all([
    prisma.appointment.findMany({
      where: { businessId: business.id, startAt: { gte: start, lt: end } },
      orderBy: { startAt: "asc" },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        status: true,
        price: true,
        depositAmount: true,
        customerId: true,
        staffMemberId: true,
        customer: { select: { firstName: true, lastName: true } },
        service: { select: { name: true } },
        staffMember: { select: { invitedEmail: true, user: { select: { name: true } } } },
      },
    }),
    prisma.staffMember.count({ where: { businessId: business.id, status: "ACTIVE" } }),
    prisma.product.findMany({
      where: { businessId: business.id, reorderThreshold: { not: null } },
      select: { name: true, quantityOnHand: true, reorderThreshold: true },
    }),
    // Cash actually taken today, ranged on paidAt — when the money moved, not
    // when the appointment happens to sit on the calendar.
    prisma.payment.aggregate({ _sum: { amount: true }, where: incomingWhere(business.id, { from: start, to: end }) }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: refundWhere(business.id, { from: start, to: end }) }),
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

  // --- low-stock products for the decision queue ---
  const lowStock = products.filter(
    (product) => product.reorderThreshold != null && Number(product.quantityOnHand) <= Number(product.reorderThreshold),
  );

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
  ];

  const bookedMinutesToday = committedToday.reduce(
    (sum, a) => sum + Math.max(0, (a.endAt.getTime() - a.startAt.getTime()) / 60000),
    0,
  );
  const capacityMinutes = Math.max(1, activeStaffCount * openMinutes);

  const pills = [
    nextUp ? `Next: ${formatTimeInTz(nextUp.startAt, timeZone)}` : "No more bookings today",
    `${unpaidDeposits.length} unpaid ${unpaidDeposits.length === 1 ? "deposit" : "deposits"}`,
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

  const PRIORITY_ORDER: Record<QueuePriority, number> = { urgent: 0, soon: 1, watch: 2 };
  queue.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

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
        sub: `${committedToday.length} ${plural(committedToday.length, "booking")} across ${activeStaffCount} ${plural(activeStaffCount, "team member")} · ${money(bookedToday, currency)} booked.`,
      };
    }

    return {
      headline: `${committedToday.length} ${plural(committedToday.length, "booking")} today with ${hoursLabel(freeMinutes)} still open.`,
      sub: busiestWindow
        ? `Your busiest stretch is ${busiestWindow}. ${money(bookedToday, currency)} booked, ${money(collectedToday, currency)} collected.`
        : `${money(bookedToday, currency)} booked, ${money(collectedToday, currency)} collected.`,
    };
  })();

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
    pulse: [],
    hero,
    secondary: {
      freeCapacity: hoursLabel(freeMinutes),
      bookedValue: money(bookedToday, currency),
      returningToday: 0,
      busiest: busiestWindow,
    },
    pills,
    queue,
    timeline,
    appointments,
    clientSignals: [],
    staff: [],
    inventory: [],
  };
}
