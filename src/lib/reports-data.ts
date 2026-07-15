import "server-only";

import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { money, deltaLabel, pct } from "@/lib/format";

export type ReportKpi = { label: string; value: string; detail: string };
export type TrendBar = { label: string; amount: string; value: number };
export type TopService = { name: string; bookings: number; revenue: string; share: number };
export type StaffRow = { name: string; colorHex: string; bookings: number; revenue: string; util: number };

export type ReportsData = {
  tenant: { name: string; currency: string };
  rangeLabel: string;
  kpis: ReportKpi[];
  trend: TrendBar[];
  topServices: TopService[];
  staff: StaffRow[];
  retention: { repeatRate: number; returning: number; total: number };
};

const REALISED = new Set(["COMPLETED", "CONFIRMED"]);
const DAY = 24 * 60 * 60 * 1000;

export async function getReportsData(businessSlug: string): Promise<ReportsData | null> {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const business = await prisma.business.findUnique({ where: { slug: businessSlug } });
  if (!business) return null;

  const currency = business.currency;
  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * DAY);
  const since60 = new Date(now.getTime() - 60 * DAY);
  const trendStart = new Date(now.getTime() - 6 * 7 * DAY);

  const [payments, appointments] = await Promise.all([
    prisma.payment.findMany({
      where: { businessId: business.id, status: "SUCCESS", createdAt: { gte: since60 } },
      select: { amount: true, type: true, createdAt: true },
    }),
    prisma.appointment.findMany({
      where: { businessId: business.id, startAt: { gte: since60 } },
      select: {
        startAt: true,
        status: true,
        price: true,
        customerId: true,
        service: { select: { name: true } },
        staffMember: { select: { id: true, colorHex: true, user: { select: { name: true } }, invitedEmail: true } },
      },
      take: 4000,
    }),
  ]);

  const incoming = (p: { type: string; amount: unknown }) => p.type !== "REFUND";
  const revenue30 = payments
    .filter((p) => p.createdAt >= since30 && incoming(p))
    .reduce((s, p) => s + Number(p.amount), 0);
  const revenuePrev = payments
    .filter((p) => p.createdAt < since30 && incoming(p))
    .reduce((s, p) => s + Number(p.amount), 0);

  const appts30 = appointments.filter((a) => a.startAt >= since30);
  const bookings30 = appts30.length;
  const bookingsPrev = appointments.length - bookings30;
  const completed30 = appts30.filter((a) => a.status === "COMPLETED").length;
  const realised30 = appts30.filter((a) => REALISED.has(a.status));
  const avgTicket = realised30.length
    ? realised30.reduce((s, a) => s + Number(a.price), 0) / realised30.length
    : 0;

  // Weekly revenue trend (6 buckets).
  const buckets: { label: string; total: number }[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const bStart = new Date(now.getTime() - (i + 1) * 7 * DAY);
    const bEnd = new Date(now.getTime() - i * 7 * DAY);
    const total = payments
      .filter((p) => incoming(p) && p.createdAt >= bStart && p.createdAt < bEnd && p.createdAt >= trendStart)
      .reduce((s, p) => s + Number(p.amount), 0);
    buckets.push({ label: i === 0 ? "This wk" : `${i}w ago`, total });
  }
  const trendMax = Math.max(1, ...buckets.map((b) => b.total));
  const trend: TrendBar[] = buckets.map((b) => ({
    label: b.label,
    amount: money(b.total, currency),
    value: pct(b.total, trendMax),
  }));

  // Top services by realised revenue (30d).
  const svcMap = new Map<string, { bookings: number; revenue: number }>();
  for (const a of realised30) {
    const key = a.service?.name ?? "—";
    const cur = svcMap.get(key) ?? { bookings: 0, revenue: 0 };
    cur.bookings += 1;
    cur.revenue += Number(a.price);
    svcMap.set(key, cur);
  }
  const svcRevMax = Math.max(1, ...[...svcMap.values()].map((v) => v.revenue));
  const topServices: TopService[] = [...svcMap.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 6)
    .map(([name, v]) => ({ name, bookings: v.bookings, revenue: money(v.revenue, currency), share: pct(v.revenue, svcRevMax) }));

  // Staff leaderboard (30d realised revenue + share of total).
  const staffMap = new Map<string, { name: string; colorHex: string; bookings: number; revenue: number }>();
  for (const a of realised30) {
    if (!a.staffMember) continue;
    const id = a.staffMember.id;
    const name = a.staffMember.user?.name ?? a.staffMember.invitedEmail?.split("@")[0] ?? "Team member";
    const cur = staffMap.get(id) ?? { name, colorHex: a.staffMember.colorHex ?? "#6d315f", bookings: 0, revenue: 0 };
    cur.bookings += 1;
    cur.revenue += Number(a.price);
    staffMap.set(id, cur);
  }
  const staffRevMax = Math.max(1, ...[...staffMap.values()].map((v) => v.revenue));
  const staff: StaffRow[] = [...staffMap.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6)
    .map((v) => ({ name: v.name, colorHex: v.colorHex, bookings: v.bookings, revenue: money(v.revenue, currency), util: pct(v.revenue, staffRevMax) }));

  // Retention: distinct customers with 2+ visits in the 60d window.
  const visitCounts = new Map<string, number>();
  for (const a of appointments) visitCounts.set(a.customerId, (visitCounts.get(a.customerId) ?? 0) + 1);
  const total = visitCounts.size;
  const returning = [...visitCounts.values()].filter((c) => c >= 2).length;

  return {
    tenant: { name: business.name, currency },
    rangeLabel: "Last 30 days",
    kpis: [
      { label: "Revenue", value: money(revenue30, currency), detail: `${deltaLabel(revenue30, revenuePrev)} vs prior 30d` },
      { label: "Bookings", value: String(bookings30), detail: `${deltaLabel(bookings30, bookingsPrev)} vs prior 30d` },
      { label: "Completion rate", value: `${pct(completed30, bookings30)}%`, detail: `${completed30} of ${bookings30} completed` },
      { label: "Avg. ticket", value: money(avgTicket, currency), detail: `${realised30.length} realised bookings` },
    ],
    trend,
    topServices,
    staff,
    retention: { repeatRate: pct(returning, total), returning, total },
  };
}
