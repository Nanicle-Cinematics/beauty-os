import "server-only";

import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { money, deltaLabel } from "@/lib/format";
import { depositDue } from "@/lib/money";
import { formatDayMonthInTz, formatTimeInTz } from "@/lib/date";
import type { BadgeTone } from "@/components/ui";

export type Insight = {
  id: string;
  kind: string;
  tone: BadgeTone;
  priority: "critical" | "high" | "medium" | "low";
  impact: string;
  title: string;
  body: string;
  why: string;
  steps: string[];
  draft?: string;
  action?: { label: string; path: string };
};

export type AiGuideStep = {
  title: string;
  body: string;
  path: string;
  action: string;
  done: boolean;
};

export type WeeklyForecast = {
  title: string;
  summary: string;
  booked: string;
  expectedDeposits: string;
  bookingCount: number;
  busiestDay: string;
  risks: string[];
};

export type AiInsightsData = {
  tenant: { name: string; createdAt: Date };
  summary: string;
  focus: string;
  assistantScore: number;
  moneyAtRisk: string;
  quickWins: string[];
  guide: { show: boolean; title: string; summary: string; steps: AiGuideStep[] };
  weeklyForecast: WeeklyForecast;
  insights: Insight[];
};

const DAY = 24 * 60 * 60 * 1000;
const priorityRank: Record<Insight["priority"], number> = { critical: 0, high: 1, medium: 2, low: 3 };

function fullName(customer: { firstName: string; lastName: string | null }) {
  return [customer.firstName, customer.lastName].filter(Boolean).join(" ");
}

function paidForAppointment(payments: { amount: unknown; type: string; status: string }[]) {
  let paid = 0;
  for (const p of payments) {
    if (p.status !== "SUCCESS") continue;
    if (p.type === "REFUND") paid -= Number(p.amount);
    else if (["DEPOSIT", "FULL_PAYMENT", "BALANCE"].includes(p.type)) paid += Number(p.amount);
  }
  return paid;
}

function weekdayKey(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone }).format(date);
}

function hourKey(date: Date, timeZone: string) {
  return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone }).format(date));
}

function hourLabel(hour: number) {
  const h = ((hour % 24) + 24) % 24;
  const suffix = h < 12 ? "am" : "pm";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}${suffix}`;
}

function insightSort(a: Insight, b: Insight) {
  const byPriority = priorityRank[a.priority] - priorityRank[b.priority];
  if (byPriority !== 0) return byPriority;
  return b.impact.localeCompare(a.impact);
}

export async function getAiInsightsData(businessSlug: string): Promise<AiInsightsData | null> {
  if (!isDatabaseConfigured()) return null;

  const business = await prisma.business.findUnique({ where: { slug: businessSlug } });
  if (!business) return null;

  const currency = business.currency;
  const timeZone = business.timezone || "UTC";
  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * DAY);
  const since60 = new Date(now.getTime() - 60 * DAY);
  const since90 = new Date(now.getTime() - 90 * DAY);
  const next14 = new Date(now.getTime() + 14 * DAY);

  const bid = business.id;
  const revenueWhere = (from: Date, to?: Date) => ({
    businessId: bid,
    status: "SUCCESS" as const,
    type: { not: "REFUND" as const },
    createdAt: to ? { gte: from, lt: to } : { gte: from },
  });

  const in7 = new Date(now.getTime() + 7 * DAY);
  // All computed in Postgres — no unbounded appointment/payment scans.
  const [
    rev30Agg,
    revPrevAgg,
    upcomingAgg,
    svcGroups,
    lapseGroups,
    products,
    customerCount,
    expiredHolds,
    expiringHolds,
    upcomingDetailed,
    recentAppointments,
    staffGroups,
    overdueInvoices,
    activeCampaignCount,
    serviceCount,
    appointmentCount,
    staffCount,
  ] = await Promise.all([
    prisma.payment.aggregate({ _sum: { amount: true }, where: revenueWhere(since30) }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: revenueWhere(since60, since30) }),
    // Upcoming bookings and their payments — the deposit is 50% of price
    // (money.ts), computed per booking, so this needs the rows, not an aggregate
    // on the retired depositAmount column. Bounded read (holds excluded).
    prisma.appointment.findMany({
      where: { businessId: bid, startAt: { gte: now }, status: { notIn: ["HOLD", "CANCELLED", "NO_SHOW"] } },
      select: { price: true, payments: { select: { amount: true, type: true, status: true } } },
      take: 500,
    }),
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
    prisma.appointment.findMany({
      where: { businessId: bid, startAt: { gte: now, lt: next14 }, status: { notIn: ["HOLD", "CANCELLED", "NO_SHOW"] } },
      select: {
        id: true,
        price: true,
        startAt: true,
        customer: { select: { firstName: true, lastName: true } },
        service: { select: { name: true } },
        payments: { select: { amount: true, type: true, status: true } },
      },
      orderBy: { startAt: "asc" },
      take: 40,
    }),
    prisma.appointment.findMany({
      where: { businessId: bid, startAt: { gte: since90 }, status: { in: ["COMPLETED", "CONFIRMED"] } },
      select: { startAt: true, price: true, serviceId: true },
      take: 1000,
    }),
    prisma.appointment.groupBy({
      by: ["staffMemberId"],
      _sum: { price: true },
      _count: true,
      where: { businessId: bid, startAt: { gte: since30 }, status: { in: ["COMPLETED", "CONFIRMED"] }, staffMemberId: { not: null } },
    }),
    prisma.invoice.aggregate({
      _sum: { total: true, amountPaid: true },
      _count: true,
      where: { businessId: bid, status: { in: ["OVERDUE", "SENT", "PARTIALLY_PAID"] }, dueDate: { lt: now } },
    }),
    prisma.campaign.count({ where: { businessId: bid, status: { in: ["DRAFT", "SCHEDULED"] } } }),
    prisma.service.count({ where: { businessId: bid, isActive: true } }),
    prisma.appointment.count({ where: { businessId: bid } }),
    prisma.staffMember.count({ where: { businessId: bid, status: "ACTIVE" } }),
  ]);

  const insights: Insight[] = [];
  const rev30 = Number(rev30Agg._sum.amount ?? 0);
  const revPrev = Number(revPrevAgg._sum.amount ?? 0);
  // 50%-deposit shortfall across upcoming bookings.
  let upcomingCount = 0;
  let upcomingTotal = 0;
  for (const a of upcomingAgg) {
    const paid = paidForAppointment(a.payments);
    const due = depositDue(Number(a.price), paid);
    if (due > 0) {
      upcomingCount += 1;
      upcomingTotal += due;
    }
  }
  const depositTargets = upcomingDetailed
    .map((a) => ({ ...a, due: depositDue(Number(a.price), paidForAppointment(a.payments)) }))
    .filter((a) => a.due > 0)
    .slice(0, 3);

  const overdueTotal = Math.max(0, Number(overdueInvoices._sum.total ?? 0) - Number(overdueInvoices._sum.amountPaid ?? 0));
  let moneyAtRiskRaw = upcomingTotal + Number(expiredHolds._sum.price ?? 0) + Number(expiringHolds._sum.price ?? 0) + overdueTotal;

  if (rev30 > 0 || revPrev > 0) {
    const up = rev30 >= revPrev;
    insights.push({
      id: "revenue",
      kind: "Revenue",
      tone: up ? "success" : "warning",
      priority: up ? "low" : "high",
      impact: up ? money(rev30, currency) : `${deltaLabel(rev30, revPrev)} vs prior 30 days`,
      title: `Revenue is trending ${deltaLabel(rev30, revPrev)} this month`,
      body: `You've taken ${money(rev30, currency)} in the last 30 days versus ${money(revPrev, currency)} the month before. ${up ? "Keep the momentum going." : "A short promo or re-booking push could recover it."}`,
      why: up ? "The last 30 days are outperforming the previous period, so the highest-value move is to reinforce what is already working." : "Revenue has softened compared with the prior 30-day window, which usually needs a fast reactivation or offer before the month drifts.",
      steps: up
        ? ["Feature the top-earning service again this week.", "Ask checkout staff to offer the same add-on to similar clients.", "Check reports before discounting anything."]
        : ["Open reports to confirm which service or day dropped.", "Create a short win-back campaign for clients not seen in 60+ days.", "Fill the next quiet weekday with a limited slot offer."],
      action: { label: "Open reports", path: "reports" },
    });
  }

  // Unpaid deposits
  if (upcomingCount > 0) {
    insights.push({
      id: "deposits",
      kind: "Cash at risk",
      tone: "warning",
      priority: upcomingTotal >= 500 ? "critical" : "high",
      impact: money(upcomingTotal, currency),
      title: `${upcomingCount} upcoming booking${upcomingCount === 1 ? "" : "s"} without a paid deposit`,
      body: `${money(upcomingTotal, currency)} in deposits is uncollected. Securing deposits reduces no-shows and protects your day.`,
      why: "These bookings are on the calendar but not financially secured. The fastest operational win is collecting the deposit before the client arrives.",
      steps: [
        "Collect the oldest or soonest deposit first.",
        "If the client does not respond, move the appointment back to pending or release the slot.",
        "Check Payments after collection so the booking no longer appears here.",
      ],
      draft: depositTargets.length
        ? `Hi ${fullName(depositTargets[0].customer)}, your ${depositTargets[0].service.name} booking on ${formatDayMonthInTz(depositTargets[0].startAt, timeZone)} at ${formatTimeInTz(depositTargets[0].startAt, timeZone)} is reserved. Please pay your ${money(depositTargets[0].due, currency)} deposit to secure it.`
        : undefined,
      action: { label: "Collect deposits", path: "payments" },
    });
  }

  if (overdueInvoices._count > 0 && overdueTotal > 0) {
    insights.push({
      id: "overdue-invoices",
      kind: "Receivables",
      tone: "danger",
      priority: overdueTotal >= 500 ? "critical" : "high",
      impact: money(overdueTotal, currency),
      title: `${overdueInvoices._count} overdue invoice${overdueInvoices._count === 1 ? "" : "s"} need follow-up`,
      body: `${money(overdueTotal, currency)} is overdue after subtracting recorded payments. This is collectable cash, not future booking value.`,
      why: "Outstanding invoices are money already earned. They should be chased before creating new discounts or promotions.",
      steps: ["Open invoices and sort by due date.", "Send a direct reminder to the highest-value overdue client.", "Record payment or void only if the invoice was created in error."],
      draft: `Hi, this is a friendly reminder that your Beauty OS invoice is overdue. Please settle the outstanding balance today or reply if you need us to resend the invoice details.`,
      action: { label: "Open invoices", path: "invoices" },
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
      priority: "critical",
      impact: money(Number(expiredHolds._sum.price ?? 0), currency),
      title: `${expiredCount} hold${expiredCount === 1 ? " has" : "s have"} expired`,
      body: `${money(Number(expiredHolds._sum.price ?? 0), currency)} of provisionally held dates are past their expiry and still sitting on your calendar. Confirm them or release the dates so someone else can take them.`,
      why: "Expired holds block calendar capacity without counting as booked revenue. They create false fullness.",
      steps: ["Review expired holds first.", "Confirm any client who is ready to pay.", "Release every unresponsive hold so the slot can be sold."],
      action: { label: "Review holds", path: "appointments" },
    });
  } else if (expiringCount > 0) {
    insights.push({
      id: "holds-expiring",
      kind: "Holds",
      tone: "warning",
      priority: "high",
      impact: money(Number(expiringHolds._sum.price ?? 0), currency),
      title: `${expiringCount} hold${expiringCount === 1 ? "" : "s"} expire${expiringCount === 1 ? "s" : ""} within 7 days`,
      body: `${money(Number(expiringHolds._sum.price ?? 0), currency)} is held but not committed, so none of it counts as booked. Chase the client to confirm, or release the date.`,
      why: "The slot is reserved but not secured. Confirming or releasing it prevents the calendar from looking fuller than the business actually is.",
      steps: ["Message the hold client today.", "Collect the deposit if they want the slot.", "Release the hold if they do not respond before expiry."],
      draft: "Hi, your appointment is currently on hold and will expire soon. Please confirm with your deposit today so we can keep the slot for you.",
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
      priority: "high",
      impact: `${lowStock.length} item${lowStock.length === 1 ? "" : "s"}`,
      title: `${names} ${lowStock.length > 2 ? `and ${lowStock.length - 2} more are` : lowStock.length === 1 ? "is" : "are"} at or below reorder level`,
      body: "Running out mid-week can force you to turn away or reschedule bookings. Reorder before it bites.",
      why: "Stockouts interrupt services and can turn confirmed appointments into refunds or reschedules.",
      steps: ["Reorder the items at or below threshold.", "Check services that consume these products before accepting more bookings.", "Update stock after purchase so future alerts stay accurate."],
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
      priority: "medium",
      impact: money(topSvcGroup.revenue, currency),
      title: `${svc?.name ?? "Your top service"} is your top earner right now`,
      body: `It brought in ${money(topSvcGroup.revenue, currency)} over the last 30 days. Feature it in a campaign or upsell it at checkout.`,
      why: "A service already proving demand is usually safer to promote than a weak service that needs discounting.",
      steps: ["Feature this service in the next campaign.", "Ask staff to offer it as an upgrade where relevant.", "Protect margin: promote value before offering a discount."],
      draft: `This week: book ${svc?.name ?? "our top service"} while slots are still open. Reply to reserve your preferred time.`,
      action: { label: "Open marketing", path: "marketing" },
    });
  }

  // Lapsing clients: most recent visit (within 90d) was 60–90d ago.
  const lapsingGroups = lapseGroups.filter((g) => g._max.startAt != null && g._max.startAt < since60);
  const lapsing = lapsingGroups.length;
  if (lapsing > 0) {
    insights.push({
      id: "lapsing",
      kind: "Retention",
      tone: "warning",
      priority: lapsing >= 5 ? "high" : "medium",
      impact: `${lapsing} client${lapsing === 1 ? "" : "s"}`,
      title: `${lapsing} client${lapsing === 1 ? " hasn't" : "s haven't"} returned in over 60 days`,
      body: `Out of ${customerCount} clients, some are slipping away. A friendly "we miss you" message often brings them back.`,
      why: "Returning clients are usually cheaper to win than new ones. This group has recent enough history to still be reachable.",
      steps: ["Open clients and filter for inactive clients.", "Send a simple win-back message today.", "Offer priority booking before discounting price."],
      draft: "Hi, we have not seen you in a while and would love to have you back. Reply with your preferred day and we will help you find a slot.",
      action: { label: "View clients", path: "clients" },
    });
  }

  const byWeekday = new Map<string, { count: number; revenue: number }>();
  const byHour = new Map<number, { count: number; revenue: number }>();
  for (const appt of recentAppointments) {
    const weekday = weekdayKey(appt.startAt, timeZone);
    const hour = hourKey(appt.startAt, timeZone);
    const weekdayStat = byWeekday.get(weekday) ?? { count: 0, revenue: 0 };
    weekdayStat.count += 1;
    weekdayStat.revenue += Number(appt.price);
    byWeekday.set(weekday, weekdayStat);
    const hourStat = byHour.get(hour) ?? { count: 0, revenue: 0 };
    hourStat.count += 1;
    hourStat.revenue += Number(appt.price);
    byHour.set(hour, hourStat);
  }

  const bestWeekday = [...byWeekday.entries()].sort((a, b) => b[1].revenue - a[1].revenue)[0];
  const bestHour = [...byHour.entries()].sort((a, b) => b[1].count - a[1].count)[0];
  if (bestWeekday && recentAppointments.length >= 5) {
    insights.push({
      id: "best-time",
      kind: "Booking pattern",
      tone: "success",
      priority: "low",
      impact: money(bestWeekday[1].revenue, currency),
      title: `${bestWeekday[0]} is currently your strongest booking day`,
      body: `${bestWeekday[0]} generated ${money(bestWeekday[1].revenue, currency)} across the last 90 days. ${bestHour ? `${hourLabel(bestHour[0])}-${hourLabel(bestHour[0] + 1)} is the most common start window.` : ""}`,
      why: "This tells you where demand already exists, so campaigns and staffing can follow real booking behavior.",
      steps: ["Keep strong staff coverage on this day.", "Avoid discounting peak windows.", "Use slower days for offers instead."],
      action: { label: "Open calendar", path: "calendar" },
    });
  }

  const topStaff = staffGroups
    .map((g) => ({ staffMemberId: g.staffMemberId, revenue: Number(g._sum.price ?? 0), count: g._count }))
    .sort((a, b) => b.revenue - a.revenue)[0];
  if (topStaff?.staffMemberId && topStaff.revenue > 0) {
    const staff = await prisma.staffMember.findUnique({
      where: { id: topStaff.staffMemberId },
      select: { displayName: true, user: { select: { name: true } } },
    });
    insights.push({
      id: "staff-leader",
      kind: "Staff signal",
      tone: "success",
      priority: "low",
      impact: money(topStaff.revenue, currency),
      title: `${staff?.displayName || staff?.user?.name || "A staff member"} is leading revenue this month`,
      body: `${topStaff.count} completed or confirmed booking${topStaff.count === 1 ? "" : "s"} produced ${money(topStaff.revenue, currency)} in the last 30 days.`,
      why: "High-performing staff patterns can guide scheduling, mentoring, and premium-service assignment.",
      steps: ["Keep this staff member on high-demand services.", "Compare their service mix with the rest of the team.", "Use their successful service flow as a template."],
      action: { label: "Open staff", path: "staff" },
    });
  }

  if (activeCampaignCount === 0 && (lapsing > 0 || !rev30 || rev30 < revPrev)) {
    insights.push({
      id: "campaign-gap",
      kind: "Marketing action",
      tone: "plum",
      priority: "medium",
      impact: "No active draft",
      title: "You have no draft or scheduled campaign supporting the current signals",
      body: "The system found a reason to contact clients, but there is no campaign ready to send.",
      why: "Insights become useful only when they turn into outreach. A draft campaign keeps the next action close.",
      steps: ["Open Marketing and create a win-back or top-service campaign.", "Use the draft copy from this page.", "Send to inactive clients first, then promote open slots."],
      draft: "A few appointment slots opened this week. Reply with your preferred day and we will help you book in.",
      action: { label: "Create campaign", path: "marketing" },
    });
  }

  insights.sort(insightSort);
  const top = insights[0];
  const summary = insights.length
    ? `${insights.length} prioritized signal${insights.length === 1 ? "" : "s"} found. Start with ${top.kind.toLowerCase()}: ${top.impact}.`
    : "Everything looks healthy right now — no pressing signals from your operation.";
  const quickWins = insights.slice(0, 3).map((i) => i.steps[0]).filter(Boolean);
  const assistantScore = Math.max(68, Math.min(98, 74 + insights.length * 4 + (moneyAtRiskRaw > 0 ? 8 : 0)));
  if (moneyAtRiskRaw < 0) moneyAtRiskRaw = 0;

  const upcomingWeek = upcomingDetailed
    .filter((a) => a.startAt >= now && a.startAt < in7)
    .map((a) => ({ ...a, due: depositDue(Number(a.price), paidForAppointment(a.payments)) }));
  const weekBookedRaw = upcomingWeek.reduce((sum, a) => sum + Number(a.price), 0);
  const weekDepositDueRaw = upcomingWeek.reduce((sum, a) => sum + a.due, 0);
  const weekByDay = new Map<string, { count: number; booked: number }>();
  for (const a of upcomingWeek) {
    const day = weekdayKey(a.startAt, timeZone);
    const stat = weekByDay.get(day) ?? { count: 0, booked: 0 };
    stat.count += 1;
    stat.booked += Number(a.price);
    weekByDay.set(day, stat);
  }
  const busiestUpcoming = [...weekByDay.entries()].sort((a, b) => b[1].booked - a[1].booked || b[1].count - a[1].count)[0];
  const weeklyRisks = [
    ...(weekDepositDueRaw > 0 ? [`${money(weekDepositDueRaw, currency)} in deposits still needs confirmation.`] : []),
    ...(expiredCount > 0 ? [`${expiredCount} expired hold${expiredCount === 1 ? "" : "s"} should be released or confirmed.`] : []),
    ...(lowStock.length > 0 ? [`${lowStock.length} low-stock item${lowStock.length === 1 ? "" : "s"} could affect delivery.`] : []),
  ];
  const weeklyForecast: WeeklyForecast = {
    title: "Next 7 days",
    summary: upcomingWeek.length
      ? `${upcomingWeek.length} booking${upcomingWeek.length === 1 ? "" : "s"} are on the calendar for the next 7 days, worth ${money(weekBookedRaw, currency)}.`
      : "No confirmed or pending bookings are scheduled for the next 7 days. Focus on filling the calendar before running discounts.",
    booked: money(weekBookedRaw, currency),
    expectedDeposits: money(weekDepositDueRaw, currency),
    bookingCount: upcomingWeek.length,
    busiestDay: busiestUpcoming ? `${busiestUpcoming[0]} (${money(busiestUpcoming[1].booked, currency)})` : "No busy day yet",
    risks: weeklyRisks.length ? weeklyRisks : ["No major forecast risks found for the next 7 days."],
  };

  const isNewWorkspace = now.getTime() - business.createdAt.getTime() <= 14 * DAY;
  const guideSteps: AiGuideStep[] = [
    { title: "Confirm your service or package menu", body: "Make prices, duration, and deposit expectations accurate before clients book.", path: "services", action: "Open services", done: serviceCount > 0 },
    { title: "Add your clients", body: "Client records power reminders, payment follow-up, invoices, and marketing.", path: "clients", action: "Open clients", done: customerCount > 0 },
    { title: "Invite your team", body: "Set roles so each person can access only the tools they need.", path: "staff", action: "Open staff", done: staffCount > 1 },
    { title: "Create your first booking", body: "Bookings start pending. Confirm only when the 50% deposit has been received.", path: "appointments?new=1#new-booking", action: "Create booking", done: appointmentCount > 0 },
    { title: "Record supplies or gear", body: "Add stock, products, or gear so low-stock warnings are useful.", path: "inventory", action: "Open inventory", done: products.length > 0 },
    { title: "Use AI Insights weekly", body: "Review the forecast, risks, and next best actions before planning the week.", path: "ai-insights", action: "View forecast", done: insights.length > 0 || upcomingWeek.length > 0 },
  ];

  return {
    tenant: { name: business.name, createdAt: business.createdAt },
    summary,
    focus: top ? `${top.kind}: ${top.title}` : "No urgent action today",
    assistantScore,
    moneyAtRisk: money(moneyAtRiskRaw, currency),
    quickWins,
    guide: {
      show: isNewWorkspace || guideSteps.some((step) => !step.done),
      title: "AI workspace setup guide",
      summary: "Follow these steps to get the workspace operational. Each step links to the exact section where the work happens.",
      steps: guideSteps,
    },
    weeklyForecast,
    insights,
  };
}
