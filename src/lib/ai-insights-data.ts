import "server-only";

import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { money, deltaLabel } from "@/lib/format";
import type { BadgeTone } from "@/components/ui";

export type Insight = {
  id: string;
  kind: string;
  tone: BadgeTone;
  title: string;
  body: string;
  action?: { label: string; path: string };
};

export type AiInsightsData = {
  tenant: { name: string };
  summary: string;
  insights: Insight[];
};

const DAY = 24 * 60 * 60 * 1000;

export async function getAiInsightsData(businessSlug: string): Promise<AiInsightsData | null> {
  if (!isDatabaseConfigured()) return null;

  const business = await prisma.business.findUnique({ where: { slug: businessSlug } });
  if (!business) return null;

  const currency = business.currency;
  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * DAY);
  const since60 = new Date(now.getTime() - 60 * DAY);
  const since90 = new Date(now.getTime() - 90 * DAY);

  const bid = business.id;
  const revenueWhere = (from: Date, to?: Date) => ({
    businessId: bid,
    status: "SUCCESS" as const,
    type: { not: "REFUND" as const },
    createdAt: to ? { gte: from, lt: to } : { gte: from },
  });

  // All computed in Postgres — no unbounded appointment/payment scans.
  const [rev30Agg, revPrevAgg, upcomingAgg, svcGroups, lapseGroups, products, customerCount] = await Promise.all([
    prisma.payment.aggregate({ _sum: { amount: true }, where: revenueWhere(since30) }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: revenueWhere(since60, since30) }),
    prisma.appointment.aggregate({ _sum: { depositAmount: true }, _count: true, where: { businessId: bid, startAt: { gte: now }, depositPaid: false, depositAmount: { gt: 0 } } }),
    prisma.appointment.groupBy({ by: ["serviceId"], _sum: { price: true }, where: { businessId: bid, status: { in: ["COMPLETED", "CONFIRMED"] }, startAt: { gte: since30 } } }),
    prisma.appointment.groupBy({ by: ["customerId"], _max: { startAt: true }, where: { businessId: bid, startAt: { gte: since90 } } }),
    prisma.product.findMany({ where: { businessId: bid }, select: { name: true, quantityOnHand: true, reorderThreshold: true } }),
    prisma.customer.count({ where: { businessId: bid } }),
  ]);

  const insights: Insight[] = [];
  const rev30 = Number(rev30Agg._sum.amount ?? 0);
  const revPrev = Number(revPrevAgg._sum.amount ?? 0);
  const upcomingCount = upcomingAgg._count;
  const upcomingTotal = Number(upcomingAgg._sum.depositAmount ?? 0);
  if (rev30 > 0 || revPrev > 0) {
    const up = rev30 >= revPrev;
    insights.push({
      id: "revenue",
      kind: "Revenue",
      tone: up ? "success" : "warning",
      title: `Revenue is trending ${deltaLabel(rev30, revPrev)} this month`,
      body: `You've taken ${money(rev30, currency)} in the last 30 days versus ${money(revPrev, currency)} the month before. ${up ? "Keep the momentum going." : "A short promo or re-booking push could recover it."}`,
      action: { label: "Open reports", path: "reports" },
    });
  }

  // Unpaid deposits
  if (upcomingCount > 0) {
    insights.push({
      id: "deposits",
      kind: "Cash at risk",
      tone: "warning",
      title: `${upcomingCount} upcoming booking${upcomingCount === 1 ? "" : "s"} without a paid deposit`,
      body: `${money(upcomingTotal, currency)} in deposits is uncollected. Securing deposits reduces no-shows and protects your day.`,
      action: { label: "Collect deposits", path: "payments" },
    });
  }

  // Inventory risk
  const lowStock = products.filter((p) => p.reorderThreshold != null && Number(p.quantityOnHand) <= Number(p.reorderThreshold));
  if (lowStock.length > 0) {
    const names = lowStock.slice(0, 2).map((p) => p.name).join(" and ");
    insights.push({
      id: "inventory",
      kind: "Inventory risk",
      tone: "danger",
      title: `${names} ${lowStock.length > 2 ? `and ${lowStock.length - 2} more are` : lowStock.length === 1 ? "is" : "are"} at or below reorder level`,
      body: "Running out mid-week can force you to turn away or reschedule bookings. Reorder before it bites.",
      action: { label: "View inventory", path: "inventory" },
    });
  }

  // Top / highest-earning service (30d)
  const topSvcGroup = svcGroups
    .map((g) => ({ serviceId: g.serviceId, revenue: Number(g._sum.price ?? 0) }))
    .sort((a, b) => b.revenue - a.revenue)[0];
  if (topSvcGroup && topSvcGroup.revenue > 0) {
    const svc = await prisma.service.findUnique({ where: { id: topSvcGroup.serviceId }, select: { name: true } });
    insights.push({
      id: "top-service",
      kind: "Opportunity",
      tone: "plum",
      title: `${svc?.name ?? "Your top service"} is your top earner right now`,
      body: `It brought in ${money(topSvcGroup.revenue, currency)} over the last 30 days. Feature it in a campaign or upsell it at checkout.`,
      action: { label: "Open marketing", path: "marketing" },
    });
  }

  // Lapsing clients: most recent visit (within 90d) was 60–90d ago.
  const lapsing = lapseGroups.filter((g) => g._max.startAt != null && g._max.startAt < since60).length;
  if (lapsing > 0) {
    insights.push({
      id: "lapsing",
      kind: "Retention",
      tone: "warning",
      title: `${lapsing} client${lapsing === 1 ? " hasn't" : "s haven't"} returned in over 60 days`,
      body: `Out of ${customerCount} clients, some are slipping away. A friendly "we miss you" message often brings them back.`,
      action: { label: "View clients", path: "clients" },
    });
  }

  const summary = insights.length
    ? `${insights.length} thing${insights.length === 1 ? "" : "s"} worth your attention across revenue, cash, stock, and clients.`
    : "Everything looks healthy right now — no pressing signals from your operation.";

  return { tenant: { name: business.name }, summary, insights };
}
