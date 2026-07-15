import "server-only";

import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { money, titleCase, pct, deltaLabel } from "@/lib/format";

export type FinanceKpi = { label: string; value: string; detail: string };
export type FinancePayment = { id: string; client: string; method: string; type: string; amount: string; isRefund: boolean; when: string };
export type FinanceExpense = { id: string; category: string; description: string; amount: string; when: string };

export type FinanceData = {
  tenant: { name: string; currency: string };
  kpis: FinanceKpi[];
  flow: { revenue: number; expenses: number; net: number; revenueLabel: string; expensesLabel: string; netLabel: string; revenueShare: number; expensesShare: number };
  recentPayments: FinancePayment[];
  recentExpenses: FinanceExpense[];
};

const DAY = 24 * 60 * 60 * 1000;

function clientName(c: { firstName: string; lastName: string | null } | null) {
  if (!c) return "Walk-in";
  return [c.firstName, c.lastName].filter(Boolean).join(" ");
}

function shortDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(date);
}

export async function getFinanceData(businessSlug: string): Promise<FinanceData | null> {
  if (!isDatabaseConfigured()) return null;

  const business = await prisma.business.findUnique({ where: { slug: businessSlug } });
  if (!business) return null;

  const currency = business.currency;
  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * DAY);
  const since60 = new Date(now.getTime() - 60 * DAY);

  const [payments, expenses, recentPayments, recentExpenses, outstandingAgg] = await Promise.all([
    prisma.payment.findMany({
      where: { businessId: business.id, status: "SUCCESS", createdAt: { gte: since60 } },
      select: { amount: true, type: true, createdAt: true },
    }),
    prisma.expense.findMany({
      where: { businessId: business.id, incurredAt: { gte: since60 } },
      select: { amount: true, incurredAt: true },
    }),
    prisma.payment.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, amount: true, method: true, type: true, createdAt: true, customer: { select: { firstName: true, lastName: true } } },
    }),
    prisma.expense.findMany({
      where: { businessId: business.id },
      orderBy: { incurredAt: "desc" },
      take: 8,
      select: { id: true, category: true, description: true, amount: true, incurredAt: true },
    }),
    prisma.customer.aggregate({ where: { businessId: business.id }, _sum: { outstandingBalance: true } }),
  ]);

  const incoming = (p: { type: string }) => p.type !== "REFUND";
  const rev30 = payments.filter((p) => p.createdAt >= since30 && incoming(p)).reduce((s, p) => s + Number(p.amount), 0);
  const revPrev = payments.filter((p) => p.createdAt < since30 && incoming(p)).reduce((s, p) => s + Number(p.amount), 0);
  const exp30 = expenses.filter((e) => e.incurredAt >= since30).reduce((s, e) => s + Number(e.amount), 0);
  const expPrev = expenses.filter((e) => e.incurredAt < since30).reduce((s, e) => s + Number(e.amount), 0);
  const net30 = rev30 - exp30;
  const outstanding = Number(outstandingAgg._sum.outstandingBalance ?? 0);
  const flowMax = Math.max(1, rev30, exp30);

  return {
    tenant: { name: business.name, currency },
    kpis: [
      { label: "Revenue (30d)", value: money(rev30, currency), detail: `${deltaLabel(rev30, revPrev)} vs prior 30d` },
      { label: "Expenses (30d)", value: money(exp30, currency), detail: `${deltaLabel(exp30, expPrev)} vs prior 30d` },
      { label: "Net profit (30d)", value: money(net30, currency), detail: rev30 > 0 ? `${pct(Math.max(net30, 0), rev30)}% margin` : "No revenue yet" },
      { label: "Outstanding", value: money(outstanding, currency), detail: "Owed by clients" },
    ],
    flow: {
      revenue: rev30,
      expenses: exp30,
      net: net30,
      revenueLabel: money(rev30, currency),
      expensesLabel: money(exp30, currency),
      netLabel: money(net30, currency),
      revenueShare: pct(rev30, flowMax),
      expensesShare: pct(exp30, flowMax),
    },
    recentPayments: recentPayments.map((p) => ({
      id: p.id,
      client: clientName(p.customer),
      method: titleCase(p.method),
      type: titleCase(p.type),
      amount: `${p.type === "REFUND" ? "−" : ""}${money(Number(p.amount), currency)}`,
      isRefund: p.type === "REFUND",
      when: shortDate(p.createdAt),
    })),
    recentExpenses: recentExpenses.map((e) => ({
      id: e.id,
      category: e.category,
      description: e.description ?? "—",
      amount: money(Number(e.amount), currency),
      when: shortDate(e.incurredAt),
    })),
  };
}
