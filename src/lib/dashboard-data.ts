import "server-only";

import { prisma, isDatabaseConfigured } from "@/lib/prisma";
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

export type PulseBar = { label: string; value: number };
export type DashAppointment = {
  id: string;
  time: string;
  client: string;
  service: string;
  staff: string;
  status: string;
  value: string;
};
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
  stats: DashStat[];
  pulse: PulseBar[];
  pills: string[];
  tasks: string[];
  appointments: DashAppointment[];
  clientSignals: DashClientSignal[];
  staff: DashStaff[];
  inventory: DashInventory[];
};

const STAFF_COLORS = ["bg-emerald-500", "bg-rose-500", "bg-blue-500", "bg-amber-500", "bg-violet-500"];
const CANCELLED = new Set(["CANCELLED", "NO_SHOW"]);
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

const fallbackDashboard: Record<string, TenantDashboardData> = {
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
    todayLabel: "Today",
    stats: [
      { label: "Today revenue", value: "GH₵ 1,850", detail: "3 booked services", tone: "rose" },
      { label: "Bookings today", value: "3", detail: "1 pending confirmation", tone: "teal" },
      { label: "Client retention", value: "0%", detail: "0 of 3 are repeat", tone: "blue" },
      { label: "Inventory alerts", value: "3", detail: "3 below reorder point", tone: "amber" },
    ],
    pulse: [
      { label: "Bookings", value: 50 },
      { label: "Capacity", value: 42 },
      { label: "Checkout", value: 0 },
    ],
    pills: ["Next: 10:30", "3 unpaid deposits", "0 birthdays today"],
    tasks: ["Confirm 2 pending appointments", "Reorder Nude gel polish", "Reorder Lace adhesive"],
    appointments: [
      { id: "demo-1", time: "09:00", client: "Ama Serwaa", service: "Silk press + trim", staff: "Nadia", status: "Confirmed", value: "GH₵ 420" },
      { id: "demo-2", time: "10:30", client: "Esi Manu", service: "Soft glam", staff: "Nadia", status: "Pending", value: "GH₵ 650" },
      { id: "demo-3", time: "12:00", client: "Akua Mensah", service: "Wig install", staff: "Nadia", status: "Pending", value: "GH₵ 780" },
    ],
    clientSignals: [
      { name: "Akua Mensah", tag: "bridal", note: "Likes soft finish", spend: "GH₵ 780" },
      { name: "Esi Manu", tag: "repeat", note: "Sensitive skin", spend: "GH₵ 650" },
      { name: "Ama Serwaa", tag: "VIP", note: "Prefers warm undertones", spend: "GH₵ 420" },
    ],
    staff: [
      { name: "Nadia Mensah", role: "Owner", bookedLabel: "3 today", bookedPercent: 42, revenue: "GH₵ 1,850", color: "bg-emerald-500" },
    ],
    inventory: [
      { item: "Nude gel polish", stock: "1 in stock", level: 25 },
      { item: "Lace adhesive", stock: "2 in stock", level: 40 },
      { item: "Developer 20 vol", stock: "4 in stock", level: 67 },
    ],
  },
  "luxe-lash-lab": {
    tenant: {
      id: "sample_luxe_lash",
      name: "Luxe Lash Lab",
      slug: "luxe-lash-lab",
      currency: "GHS",
      planName: "Growth Suite",
      staffSeats: 3,
      branchCount: 1,
      automationStatus: "trial reminders active",
    },
    todayLabel: "Today",
    stats: [
      { label: "Today revenue", value: "GH₵ 580", detail: "2 booked services", tone: "rose" },
      { label: "Bookings today", value: "2", detail: "1 pending confirmation", tone: "teal" },
      { label: "Client retention", value: "0%", detail: "0 of 3 are repeat", tone: "blue" },
      { label: "Inventory alerts", value: "1", detail: "1 below reorder point", tone: "amber" },
    ],
    pulse: [
      { label: "Bookings", value: 33 },
      { label: "Capacity", value: 38 },
      { label: "Checkout", value: 0 },
    ],
    pills: ["Next: 11:30", "2 unpaid deposits", "1 birthday today"],
    tasks: ["Confirm 1 pending appointment", "Reorder Lash adhesive"],
    appointments: [
      { id: "demo-4", time: "09:00", client: "Yaa Boateng", service: "Classic lash set", staff: "Mina", status: "Confirmed", value: "GH₵ 360" },
      { id: "demo-5", time: "11:30", client: "Afia Owusu", service: "Brow lamination", staff: "Mina", status: "Pending", value: "GH₵ 220" },
    ],
    clientSignals: [
      { name: "Serwaa King", tag: "birthday", note: "Send birthday promo", spend: "GH₵ 0" },
      { name: "Yaa Boateng", tag: "new", note: "Prefers natural finish", spend: "GH₵ 360" },
      { name: "Afia Owusu", tag: "VIP", note: "Avoid strong adhesive", spend: "GH₵ 220" },
    ],
    staff: [
      { name: "Mina Owusu", role: "Owner", bookedLabel: "2 today", bookedPercent: 38, revenue: "GH₵ 580", color: "bg-emerald-500" },
    ],
    inventory: [
      { item: "Lash adhesive", stock: "2 in stock", level: 50 },
      { item: "Classic lash trays", stock: "6 in stock", level: 100 },
    ],
  },
};

export async function getTenantDashboardData(businessSlug: string): Promise<TenantDashboardData | null> {
  if (!isDatabaseConfigured()) {
    return fallbackDashboard[businessSlug] ?? null;
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

  const [todayAppointments, activeStaff, products, customers] = await Promise.all([
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
    // Bounded read: a single tenant's client list. For very large tenants
    // this should become a set of SQL aggregates rather than an in-memory scan.
    prisma.customer.findMany({
      where: { businessId: business.id },
      take: 500,
      include: {
        appointments: { select: { status: true, price: true, startAt: true }, orderBy: { startAt: "desc" } },
      },
    }),
  ]);

  // --- today's schedule ---
  const liveToday = todayAppointments.filter((appointment) => !CANCELLED.has(appointment.status));
  const revenueToday = liveToday.reduce((sum, appointment) => sum + Number(appointment.price), 0);
  const pendingToday = liveToday.filter((appointment) => appointment.status === "PENDING");
  const completedToday = todayAppointments.filter((appointment) => appointment.status === "COMPLETED");
  const unpaidDeposits = liveToday.filter(
    (appointment) => appointment.depositAmount && Number(appointment.depositAmount) > 0 && !appointment.depositPaid,
  );
  const nextUp = liveToday.find((appointment) => appointment.startAt > now);

  // --- retention ---
  const repeatClients = customers.filter(
    (customer) => customer.appointments.filter((appointment) => !CANCELLED.has(appointment.status)).length >= 2,
  ).length;
  const retention = customers.length ? (repeatClients / customers.length) * 100 : 0;

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
    const mine = liveToday.filter((appointment) => appointment.staffMemberId === member.id);
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
    const spend = realisedVisits.reduce((sum, appointment) => sum + Number(appointment.price), 0);
    const lastVisit = realisedVisits[0]?.startAt ?? null;
    return {
      name: [customer.firstName, customer.lastName].filter(Boolean).join(" "),
      spend,
      outstanding: Number(customer.outstandingBalance),
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
  const stats: DashStat[] = [
    {
      label: "Today revenue",
      value: money(revenueToday, currency),
      detail: `${liveToday.length} booked ${liveToday.length === 1 ? "service" : "services"}`,
      tone: "rose",
    },
    {
      label: "Bookings today",
      value: String(liveToday.length),
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

  const pulse: PulseBar[] = [
    { label: "Bookings", value: clampPercent((liveToday.length / Math.max(1, activeStaff.length * 6)) * 100) },
    {
      label: "Capacity",
      value: clampPercent(
        (liveToday.reduce((sum, a) => sum + (a.endAt.getTime() - a.startAt.getTime()) / 60000, 0) /
          Math.max(1, activeStaff.length * openMinutes)) *
          100,
      ),
    },
    { label: "Checkout", value: clampPercent(liveToday.length ? (completedToday.length / liveToday.length) * 100 : 0) },
  ];

  const pills = [
    nextUp ? `Next: ${formatTimeInTz(nextUp.startAt, timeZone)}` : "No more bookings today",
    `${unpaidDeposits.length} unpaid ${unpaidDeposits.length === 1 ? "deposit" : "deposits"}`,
    `${birthdaysToday.length} ${birthdaysToday.length === 1 ? "birthday" : "birthdays"} today`,
  ];

  // --- derived front-desk tasks ---
  const tasks: string[] = [];
  if (pendingToday.length) {
    tasks.push(`Confirm ${pendingToday.length} pending ${pendingToday.length === 1 ? "appointment" : "appointments"}`);
  }
  if (unpaidDeposits.length) {
    tasks.push(`Collect ${unpaidDeposits.length} unpaid ${unpaidDeposits.length === 1 ? "deposit" : "deposits"}`);
  }
  for (const product of lowStock.slice(0, 2)) {
    tasks.push(`Reorder ${product.name}`);
  }
  const atRisk = enrichedClients.find((client) => client.lastVisitDays != null && client.lastVisitDays > 45);
  if (atRisk && tasks.length < 4) {
    tasks.push(`Win back ${atRisk.name} (no visit in ${atRisk.lastVisitDays} days)`);
  }
  if (tasks.length === 0) {
    tasks.push("All clear — no actions need a decision right now");
  }

  const appointments: DashAppointment[] = liveToday.slice(0, 6).map((appointment) => ({
    id: appointment.id,
    time: formatTimeInTz(appointment.startAt, timeZone),
    client: [appointment.customer.firstName, appointment.customer.lastName].filter(Boolean).join(" "),
    service: appointment.service.name,
    staff: appointment.staffMember?.user?.name ?? appointment.staffMember?.invitedEmail ?? "Unassigned",
    status: titleCase(appointment.status),
    value: money(Number(appointment.price), currency),
  }));

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
    pulse,
    pills,
    tasks,
    appointments,
    clientSignals,
    staff,
    inventory,
  };
}
