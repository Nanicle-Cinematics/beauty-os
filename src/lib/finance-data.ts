import "server-only";

import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { bookedWhere, bookingPaymentsWhere, outstanding as outstandingOf } from "@/lib/money";
import { money, titleCase, pct, deltaLabel } from "@/lib/format";

export type FinanceKpi = { label: string; value: string; detail: string };
export type FinancePayment = { id: string; client: string; method: string; type: string; amount: string; isRefund: boolean; when: string };
export type FinanceExpense = { id: string; category: string; description: string; amount: string; when: string };
export type CategoryTotal = { category: string; amount: string; percent: number; share: number };
export type FinanceTrendPoint = { label: string; revenue: number; revenueLabel: string; expenses: number; expensesLabel: string };

export type FinanceData = {
  tenant: { name: string; currency: string };
  kpis: FinanceKpi[];
  flow: { revenue: number; expenses: number; net: number; revenueLabel: string; expensesLabel: string; netLabel: string; revenueShare: number; expensesShare: number };
  trend: FinanceTrendPoint[];
  recentPayments: FinancePayment[];
  recentExpenses: FinanceExpense[];
  expensesByCategory: CategoryTotal[];
};

const DAY = 24 * 60 * 60 * 1000;

function clientName(c: { firstName: string; lastName: string | null } | null) {
  if (!c) return "Walk-in";
  return [c.firstName, c.lastName].filter(Boolean).join(" ");
}

function shortDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(date);
}

export type ExpenseFilters = { category?: string; from?: string; to?: string; q?: string };
export type ExpenseRow = { id: string; category: string; description: string; amount: string; when: string };
export type ExpensesList = {
  tenant: { name: string; currency: string };
  categories: string[];
  filters: { category: string; from: string; to: string; q: string };
  summary: { count: number; total: string };
  byCategory: CategoryTotal[];
  expenses: ExpenseRow[];
};

function longDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

// Validate a YYYY-MM-DD string; return the trimmed value or "" so bad input
// simply drops the filter rather than throwing.
function cleanDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : value.slice(0, 10);
}

// Shared filter → Prisma where builder, so the list, breakdown, and CSV export
// all filter identically and can never drift apart.
function buildExpenseWhere(businessId: string, filters: ExpenseFilters) {
  const category = (filters.category ?? "").trim();
  const from = cleanDate(filters.from);
  const to = cleanDate(filters.to);
  const q = (filters.q ?? "").trim();

  const incurredAt: { gte?: Date; lte?: Date } = {};
  if (from) incurredAt.gte = new Date(from);
  if (to) {
    // Make the "to" bound inclusive of the whole day.
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    incurredAt.lte = end;
  }

  const where = {
    businessId,
    ...(category ? { category } : {}),
    ...(from || to ? { incurredAt } : {}),
    ...(q ? { description: { contains: q, mode: "insensitive" as const } } : {}),
  };
  return { where, normalized: { category, from, to, q } };
}

export async function getExpensesList(businessSlug: string, filters: ExpenseFilters): Promise<ExpensesList | null> {
  if (!isDatabaseConfigured()) return null;

  const business = await prisma.business.findUnique({ where: { slug: businessSlug } });
  if (!business) return null;

  const currency = business.currency;
  const { where, normalized } = buildExpenseWhere(business.id, filters);
  const { category, from, to, q } = normalized;

  const [distinctCats, rows, agg, grouped] = await Promise.all([
    prisma.expense.findMany({ where: { businessId: business.id }, distinct: ["category"], select: { category: true }, orderBy: { category: "asc" } }),
    prisma.expense.findMany({ where, orderBy: { incurredAt: "desc" }, take: 300, select: { id: true, category: true, description: true, amount: true, incurredAt: true } }),
    prisma.expense.aggregate({ where, _sum: { amount: true }, _count: true }),
    // Exact per-category totals for the SAME filtered set (not capped by take).
    prisma.expense.groupBy({ by: ["category"], where, _sum: { amount: true } }),
  ]);

  const total = Number(agg._sum.amount ?? 0);
  const catSums = grouped.map((g) => ({ category: g.category, sum: Number(g._sum.amount ?? 0) }));
  const catMax = Math.max(1, ...catSums.map((c) => c.sum));
  const byCategory: CategoryTotal[] = catSums
    .sort((a, b) => b.sum - a.sum)
    .map((c) => ({ category: c.category, amount: money(c.sum, currency), percent: pct(c.sum, total), share: pct(c.sum, catMax) }));

  return {
    tenant: { name: business.name, currency },
    categories: distinctCats.map((c) => c.category).filter(Boolean),
    filters: { category, from, to, q },
    summary: { count: agg._count, total: money(total, currency) },
    byCategory,
    expenses: rows.map((e) => ({
      id: e.id,
      category: e.category,
      description: e.description ?? "—",
      amount: money(Number(e.amount), currency),
      when: longDate(e.incurredAt),
    })),
  };
}

export type ExpenseCsvRow = { date: string; category: string; description: string; amount: number };

// Full filtered set (chronological) for CSV export — same filters as the list.
export async function getExpensesForExport(businessSlug: string, filters: ExpenseFilters): Promise<{ currency: string; rows: ExpenseCsvRow[] } | null> {
  if (!isDatabaseConfigured()) return null;
  const business = await prisma.business.findUnique({ where: { slug: businessSlug }, select: { id: true, currency: true } });
  if (!business) return null;

  const { where } = buildExpenseWhere(business.id, filters);
  const rows = await prisma.expense.findMany({
    where,
    orderBy: { incurredAt: "asc" },
    take: 10000,
    select: { category: true, description: true, amount: true, incurredAt: true },
  });

  return {
    currency: business.currency,
    rows: rows.map((e) => ({
      date: e.incurredAt.toISOString().slice(0, 10),
      category: e.category,
      description: e.description ?? "",
      amount: Number(e.amount),
    })),
  };
}

export type EditableExpense = { id: string; category: string; amount: string; description: string; incurredAt: string };

export async function getExpense(businessSlug: string, id: string): Promise<EditableExpense | null> {
  if (!isDatabaseConfigured()) return null;
  const business = await prisma.business.findUnique({ where: { slug: businessSlug }, select: { id: true } });
  if (!business) return null;

  const expense = await prisma.expense.findFirst({
    where: { id, businessId: business.id },
    select: { id: true, category: true, amount: true, description: true, incurredAt: true },
  });
  if (!expense) return null;

  return {
    id: expense.id,
    category: expense.category,
    amount: String(Number(expense.amount)),
    description: expense.description ?? "",
    incurredAt: expense.incurredAt.toISOString().slice(0, 10),
  };
}

export async function updateExpense({
  businessSlug,
  id,
  category,
  amount,
  description,
  incurredAt,
}: {
  businessSlug: string;
  id: string;
  category: string;
  amount: number;
  description: string;
  incurredAt: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Not available." };
  const trimmedCategory = category.trim();
  if (!trimmedCategory) return { ok: false, error: "Add an expense category." };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Enter an amount greater than zero." };

  const business = await prisma.business.findUnique({ where: { slug: businessSlug }, select: { id: true } });
  if (!business) return { ok: false, error: "Business not found." };

  const parsed = incurredAt ? new Date(incurredAt) : new Date();
  const when = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

  // Scope the write to this business so an id from another tenant can't be edited.
  const result = await prisma.expense.updateMany({
    where: { id, businessId: business.id },
    data: { category: trimmedCategory, amount, description: description.trim() || null, incurredAt: when },
  });
  if (result.count === 0) return { ok: false, error: "Expense not found." };
  return { ok: true };
}

export async function deleteExpense(businessSlug: string, id: string): Promise<{ ok: boolean }> {
  if (!isDatabaseConfigured()) return { ok: false };
  const business = await prisma.business.findUnique({ where: { slug: businessSlug }, select: { id: true } });
  if (!business) return { ok: false };
  const result = await prisma.expense.deleteMany({ where: { id, businessId: business.id } });
  return { ok: result.count > 0 };
}

export async function createExpense({
  businessSlug,
  category,
  amount,
  description,
  incurredAt,
}: {
  businessSlug: string;
  category: string;
  amount: number;
  description: string;
  incurredAt: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isDatabaseConfigured()) {
    return { ok: false, error: "Not available." };
  }
  const trimmedCategory = category.trim();
  if (!trimmedCategory) {
    return { ok: false, error: "Add an expense category." };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Enter an amount greater than zero." };
  }

  const business = await prisma.business.findUnique({ where: { slug: businessSlug }, select: { id: true } });
  if (!business) {
    return { ok: false, error: "Business not found." };
  }

  // Only accept a valid date; otherwise record it as incurred now.
  const parsed = incurredAt ? new Date(incurredAt) : new Date();
  const when = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

  await prisma.expense.create({
    data: {
      businessId: business.id,
      category: trimmedCategory,
      amount,
      description: description.trim() || null,
      incurredAt: when,
    },
  });

  return { ok: true };
}

export async function getFinanceData(businessSlug: string): Promise<FinanceData | null> {
  if (!isDatabaseConfigured()) return null;

  const business = await prisma.business.findUnique({ where: { slug: businessSlug } });
  if (!business) return null;

  const currency = business.currency;
  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * DAY);
  const since60 = new Date(now.getTime() - 60 * DAY);

  // Revenue = SUCCESS, non-refund payments. All sums/grouping run in Postgres
  // (no unbounded row reads, correct for tenants of any size).
  const revenueWhere = (from: Date, to?: Date) => ({
    businessId: business.id,
    status: "SUCCESS" as const,
    type: { not: "REFUND" as const },
    createdAt: to ? { gte: from, lt: to } : { gte: from },
  });

  // Six weekly buckets (oldest → newest) for the revenue-vs-expenses trend.
  const bucketBounds = Array.from({ length: 6 }, (_unused, idx) => {
    const i = 5 - idx;
    return {
      label: i === 0 ? "This wk" : `${i}w ago`,
      start: new Date(now.getTime() - (i + 1) * 7 * DAY),
      end: new Date(now.getTime() - i * 7 * DAY),
    };
  });

  const [rev30Agg, revPrevAgg, exp30Agg, expPrevAgg, catGroups, recentPayments, recentExpenses, bookedAgg, bookingPaidAgg, revTrendAggs, expTrendAggs] = await Promise.all([
    prisma.payment.aggregate({ _sum: { amount: true }, where: revenueWhere(since30) }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: revenueWhere(since60, since30) }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { businessId: business.id, incurredAt: { gte: since30 } } }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { businessId: business.id, incurredAt: { gte: since60, lt: since30 } } }),
    prisma.expense.groupBy({ by: ["category"], _sum: { amount: true }, where: { businessId: business.id, incurredAt: { gte: since30 } } }),
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
    // Outstanding is derived: booked appointments minus payments actually made.
    // This previously summed `Customer.outstandingBalance`, a counter that only
    // ever decreased, so it reported GH₵0 owed no matter what was unpaid.
    prisma.appointment.aggregate({ _sum: { price: true }, where: bookedWhere(business.id) }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: bookingPaymentsWhere(business.id) }),
    Promise.all(bucketBounds.map((b) => prisma.payment.aggregate({ _sum: { amount: true }, where: revenueWhere(b.start, b.end) }))),
    Promise.all(bucketBounds.map((b) => prisma.expense.aggregate({ _sum: { amount: true }, where: { businessId: business.id, incurredAt: { gte: b.start, lt: b.end } } }))),
  ]);

  const trend: FinanceTrendPoint[] = bucketBounds.map((b, i) => {
    const rev = Number(revTrendAggs[i]._sum.amount ?? 0);
    const exp = Number(expTrendAggs[i]._sum.amount ?? 0);
    return { label: b.label, revenue: rev, revenueLabel: money(rev, currency), expenses: exp, expensesLabel: money(exp, currency) };
  });

  const rev30 = Number(rev30Agg._sum.amount ?? 0);
  const revPrev = Number(revPrevAgg._sum.amount ?? 0);
  const exp30 = Number(exp30Agg._sum.amount ?? 0);
  const expPrev = Number(expPrevAgg._sum.amount ?? 0);
  const net30 = rev30 - exp30;
  const outstanding = outstandingOf(Number(bookedAgg._sum.price ?? 0), Number(bookingPaidAgg._sum.amount ?? 0));
  const flowMax = Math.max(1, rev30, exp30);

  const catSums = catGroups.map((g) => ({ category: g.category, sum: Number(g._sum.amount ?? 0) }));
  const catMax = Math.max(1, ...catSums.map((c) => c.sum));
  const expensesByCategory: CategoryTotal[] = catSums
    .sort((a, b) => b.sum - a.sum)
    .map((c) => ({ category: c.category, amount: money(c.sum, currency), percent: pct(c.sum, exp30), share: pct(c.sum, catMax) }));

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
    trend,
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
    expensesByCategory,
  };
}
