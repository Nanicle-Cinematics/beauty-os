import "server-only";

import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { money, deltaLabel, pct } from "@/lib/format";

export type ReportKpi = { label: string; value: string; detail: string };
export type TrendBar = { label: string; amount: string; value: number; raw: number };
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

  // Everything below is computed by Postgres (aggregate/groupBy) so it stays
  // correct and cheap for tenants of any size — no unbounded row scans.
  const bid = business.id;
  const REALISED_STATUS = ["COMPLETED", "CONFIRMED"] as const;
  const revenueWhere = (from: Date, to?: Date) => ({
    businessId: bid,
    status: "SUCCESS" as const,
    type: { not: "REFUND" as const },
    createdAt: to ? { gte: from, lt: to } : { gte: from },
  });
  const realisedWhere = { businessId: bid, status: { in: [...REALISED_STATUS] }, startAt: { gte: since30 } };

  // Six weekly revenue buckets (oldest → newest).
  const bucketBounds = Array.from({ length: 6 }, (_unused, idx) => {
    const i = 5 - idx;
    return {
      label: i === 0 ? "This wk" : `${i}w ago`,
      start: new Date(now.getTime() - (i + 1) * 7 * DAY),
      end: new Date(now.getTime() - i * 7 * DAY),
    };
  });

  const [rev30Agg, revPrevAgg, bookings30, bookingsPrev, completed30, avgAgg, trendAggs, svcGroups, staffGroups, retentionGroups] =
    await Promise.all([
      prisma.payment.aggregate({ _sum: { amount: true }, where: revenueWhere(since30) }),
      prisma.payment.aggregate({ _sum: { amount: true }, where: revenueWhere(since60, since30) }),
      // `not: "HOLD"` throughout: a hold was never a booking. Cancellations stay
      // counted here on purpose — these are gross bookings, and the completion
      // rate below is measured against them. See docs/HOLDS.md.
      prisma.appointment.count({ where: { businessId: bid, startAt: { gte: since30 }, status: { not: "HOLD" } } }),
      prisma.appointment.count({ where: { businessId: bid, startAt: { gte: since60, lt: since30 }, status: { not: "HOLD" } } }),
      prisma.appointment.count({ where: { businessId: bid, startAt: { gte: since30 }, status: "COMPLETED" } }),
      prisma.appointment.aggregate({ _sum: { price: true }, _count: true, where: realisedWhere }),
      Promise.all(bucketBounds.map((b) => prisma.payment.aggregate({ _sum: { amount: true }, where: revenueWhere(b.start, b.end) }))),
      prisma.appointment.groupBy({ by: ["serviceId"], _sum: { price: true }, _count: true, where: realisedWhere }),
      prisma.appointment.groupBy({ by: ["staffMemberId"], _sum: { price: true }, _count: true, where: { ...realisedWhere, staffMemberId: { not: null } } }),
      prisma.appointment.groupBy({ by: ["customerId"], _count: true, where: { businessId: bid, startAt: { gte: since60 }, status: { not: "HOLD" } } }),
    ]);

  const revenue30 = Number(rev30Agg._sum.amount ?? 0);
  const revenuePrev = Number(revPrevAgg._sum.amount ?? 0);
  const realisedCount = avgAgg._count;
  const avgTicket = realisedCount ? Number(avgAgg._sum.price ?? 0) / realisedCount : 0;

  const trendTotals = trendAggs.map((a, idx) => ({ label: bucketBounds[idx].label, total: Number(a._sum.amount ?? 0) }));
  const trendMax = Math.max(1, ...trendTotals.map((t) => t.total));
  const trend: TrendBar[] = trendTotals.map((t) => ({ label: t.label, amount: money(t.total, currency), value: pct(t.total, trendMax), raw: t.total }));

  // Top services (30d realised revenue) — group in SQL, then name the top 6.
  const svcSorted = svcGroups
    .map((g) => ({ serviceId: g.serviceId, bookings: g._count, revenue: Number(g._sum.price ?? 0) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);
  const svcNames = svcSorted.length
    ? await prisma.service.findMany({ where: { id: { in: svcSorted.map((s) => s.serviceId) } }, select: { id: true, name: true } })
    : [];
  const svcNameMap = new Map(svcNames.map((s) => [s.id, s.name]));
  const svcRevMax = Math.max(1, ...svcSorted.map((s) => s.revenue));
  const topServices: TopService[] = svcSorted.map((s) => ({
    name: svcNameMap.get(s.serviceId) ?? "—",
    bookings: s.bookings,
    revenue: money(s.revenue, currency),
    share: pct(s.revenue, svcRevMax),
  }));

  // Staff leaderboard — group in SQL, then resolve the top 6.
  const staffSorted = staffGroups
    .map((g) => ({ staffMemberId: g.staffMemberId as string | null, bookings: g._count, revenue: Number(g._sum.price ?? 0) }))
    .filter((g): g is { staffMemberId: string; bookings: number; revenue: number } => Boolean(g.staffMemberId))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);
  const staffRows = staffSorted.length
    ? await prisma.staffMember.findMany({
        where: { id: { in: staffSorted.map((s) => s.staffMemberId) } },
        select: { id: true, colorHex: true, invitedEmail: true, user: { select: { name: true } } },
      })
    : [];
  const staffMap = new Map(staffRows.map((s) => [s.id, s]));
  const staffRevMax = Math.max(1, ...staffSorted.map((s) => s.revenue));
  const staff: StaffRow[] = staffSorted.map((s) => {
    const m = staffMap.get(s.staffMemberId);
    const name = m?.user?.name ?? m?.invitedEmail?.split("@")[0] ?? "Team member";
    return { name, colorHex: m?.colorHex ?? "#6d315f", bookings: s.bookings, revenue: money(s.revenue, currency), util: pct(s.revenue, staffRevMax) };
  });

  // Retention: distinct customers with 2+ visits in the 60d window.
  const total = retentionGroups.length;
  const returning = retentionGroups.filter((g) => g._count >= 2).length;

  return {
    tenant: { name: business.name, currency },
    rangeLabel: "Last 30 days",
    kpis: [
      { label: "Revenue", value: money(revenue30, currency), detail: `${deltaLabel(revenue30, revenuePrev)} vs prior 30d` },
      { label: "Bookings", value: String(bookings30), detail: `${deltaLabel(bookings30, bookingsPrev)} vs prior 30d` },
      { label: "Completion rate", value: `${pct(completed30, bookings30)}%`, detail: `${completed30} of ${bookings30} completed` },
      { label: "Avg. ticket", value: money(avgTicket, currency), detail: `${realisedCount} realised bookings` },
    ],
    trend,
    topServices,
    staff,
    retention: { repeatRate: pct(returning, total), returning, total },
  };
}
