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

  const in7 = new Date(now.getTime() + 7 * DAY);

  // All computed in Postgres — no unbounded appointment/payment scans.
  const [rev30Agg, revPrevAgg, upcomingAgg, svcGroups, lapseGroups, products, customerCount, expiredHolds, expiringHolds] = await Promise.all([
    prisma.payment.aggregate({ _sum: { amount: true }, where: revenueWhere(since30) }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: revenueWhere(since60, since30) }),
    // Deposits you can actually collect. Holds owe nothing (nothing is
    // committed), and a cancelled or no-show booking can't be chased either —
    // this now matches the other two deposit surfaces (dashboard `liveToday`
    // and payment-data's deposits-due), which already exclude all three.
    prisma.appointment.aggregate({ _sum: { depositAmount: true }, _count: true, where: { businessId: bid, startAt: { gte: now }, depositPaid: false, depositAmount: { gt: 0 }, status: { notIn: ["HOLD", "CANCELLED", "NO_SHOW"] } } }),
    prisma.appointment.groupBy({ by: ["serviceId"], _sum: { price: true }, where: { businessId: bid, status: { in: ["COMPLETED", "CONFIRMED"] }, startAt: { gte: since30 } } }),
    // Holds excluded: a client who penciled a date and vanished has not been
    // seen, and letting a hold count as contact would hide them from this list.
    prisma.appointment.groupBy({ by: ["customerId"], _max: { startAt: true }, where: { businessId: bid, startAt: { gte: since90 }, status: { not: "HOLD" } } }),
    prisma.product.findMany({ where: { businessId: bid }, select: { name: true, quantityOnHand: true, reorderThreshold: true } }),
    prisma.customer.count({ where: { businessId: bid } }),
    // Holds are excluded from every revenue figure by design, so this card is
    // the only place they surface as a number. Expiry is lazy — nothing sweeps
    // these, which is exactly why they need surfacing (docs/HOLDS.md).
    prisma.appointment.aggregate({ _sum: { price: true }, _count: true, where: { businessId: bid, status: "HOLD", holdExpiresAt: { lt: now } } }),
    prisma.appointment.aggregate({ _sum: { price: true }, _count: true, where: { businessId: bid, status: "HOLD", holdExpiresAt: { gte: now, lt: in7 } } }),
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

  // Holds needing a decision. Expired ones are the more urgent case, so they
  // win the slot outright rather than stacking two hold cards on the page.
  const expiredCount = expiredHolds._count;
  const expiringCount = expiringHolds._count;
  if (expiredCount > 0) {
    insights.push({
      id: "holds-expired",
      kind: "Holds",
      tone: "danger",
      title: `${expiredCount} hold${expiredCount === 1 ? " has" : "s have"} expired`,
      body: `${money(Number(expiredHolds._sum.price ?? 0), currency)} of provisionally held dates are past their expiry and still sitting on your calendar. Confirm them or release the dates so someone else can take them.`,
      action: { label: "Review holds", path: "appointments" },
    });
  } else if (expiringCount > 0) {
    insights.push({
      id: "holds-expiring",
      kind: "Holds",
      tone: "warning",
      title: `${expiringCount} hold${expiringCount === 1 ? "" : "s"} expire${expiringCount === 1 ? "s" : ""} within 7 days`,
      body: `${money(Number(expiringHolds._sum.price ?? 0), currency)} is held but not committed, so none of it counts as booked. Chase the client to confirm, or release the date.`,
      action: { label: "Review holds", path: "appointments" },
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
