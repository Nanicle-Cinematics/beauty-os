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
const REALISED = new Set(["COMPLETED", "CONFIRMED"]);

export async function getAiInsightsData(businessSlug: string): Promise<AiInsightsData | null> {
  if (!isDatabaseConfigured()) return null;

  const business = await prisma.business.findUnique({ where: { slug: businessSlug } });
  if (!business) return null;

  const currency = business.currency;
  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * DAY);
  const since60 = new Date(now.getTime() - 60 * DAY);
  const since90 = new Date(now.getTime() - 90 * DAY);

  const [payments, appts, upcoming, products, customerCount] = await Promise.all([
    prisma.payment.findMany({
      where: { businessId: business.id, status: "SUCCESS", createdAt: { gte: since60 } },
      select: { amount: true, type: true, createdAt: true },
    }),
    prisma.appointment.findMany({
      where: { businessId: business.id, startAt: { gte: since90 } },
      select: { startAt: true, status: true, price: true, customerId: true, service: { select: { name: true } } },
      take: 4000,
    }),
    prisma.appointment.findMany({
      where: { businessId: business.id, startAt: { gte: now }, depositPaid: false, depositAmount: { gt: 0 } },
      select: { depositAmount: true },
    }),
    prisma.product.findMany({ where: { businessId: business.id }, select: { name: true, quantityOnHand: true, reorderThreshold: true } }),
    prisma.customer.count({ where: { businessId: business.id } }),
  ]);

  const insights: Insight[] = [];
  const incoming = (p: { type: string }) => p.type !== "REFUND";

  // Revenue trend
  const rev30 = payments.filter((p) => p.createdAt >= since30 && incoming(p)).reduce((s, p) => s + Number(p.amount), 0);
  const revPrev = payments.filter((p) => p.createdAt < since30 && incoming(p)).reduce((s, p) => s + Number(p.amount), 0);
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
  if (upcoming.length > 0) {
    const total = upcoming.reduce((s, a) => s + Number(a.depositAmount ?? 0), 0);
    insights.push({
      id: "deposits",
      kind: "Cash at risk",
      tone: "warning",
      title: `${upcoming.length} upcoming booking${upcoming.length === 1 ? "" : "s"} without a paid deposit`,
      body: `${money(total, currency)} in deposits is uncollected. Securing deposits reduces no-shows and protects your day.`,
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
  const svc = new Map<string, number>();
  for (const a of appts) {
    if (a.startAt >= since30 && REALISED.has(a.status)) svc.set(a.service?.name ?? "—", (svc.get(a.service?.name ?? "—") ?? 0) + Number(a.price));
  }
  const topSvc = [...svc.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topSvc) {
    insights.push({
      id: "top-service",
      kind: "Opportunity",
      tone: "plum",
      title: `${topSvc[0]} is your top earner right now`,
      body: `It brought in ${money(topSvc[1], currency)} over the last 30 days. Feature it in a campaign or upsell it at checkout.`,
      action: { label: "Open marketing", path: "marketing" },
    });
  }

  // Lapsing clients: seen 60–90d ago, not since
  const lastVisit = new Map<string, Date>();
  for (const a of appts) {
    const cur = lastVisit.get(a.customerId);
    if (!cur || a.startAt > cur) lastVisit.set(a.customerId, a.startAt);
  }
  const lapsing = [...lastVisit.values()].filter((d) => d < since60).length;
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
