import "server-only";

import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { money, titleCase, pct, deltaLabel } from "@/lib/format";

export type FinanceKpi = { label: string; value: string; detail: string };
export type FinancePayment = { id: string; client: string; method: string; type: string; amount: string; isRefund: boolean; when: string };
export type FinanceExpense = { id: string; category: string; description: string; amount: string; when: string };
export type CategoryTotal = { category: string; amount: string; percent: number; share: number };

export type FinanceData = {
  tenant: { name: string; currency: string };
  kpis: FinanceKpi[];
  flow: { revenue: number; expenses: number; net: number; revenueLabel: string; expensesLabel: string; netLabel: string; revenueShare: number; expensesShare: number };
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

export async function getExpensesList(businessSlug: string, filters: ExpenseFilters): Promise<ExpensesList | null> {
  if (!isDatabaseConfigured()) return null;

  const business = await prisma.business.findUnique({ where: { slug: businessSlug } });
  if (!business) return null;

  const currency = business.currency;
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
    businessId: business.id,
    ...(category ? { category } : {}),
    ...(from || to ? { incurredAt } : {}),
    ...(q ? { description: { contains: q, mode: "insensitive" as const } } : {}),
  };

  const [distinctCats, rows, agg] = await Promise.all([
    prisma.expense.findMany({ where: { businessId: business.id }, distinct: ["category"], select: { category: true }, orderBy: { category: "asc" } }),
    prisma.expense.findMany({ where, orderBy: { incurredAt: "desc" }, take: 300, select: { id: true, category: true, description: true, amount: true, incurredAt: true } }),
    prisma.expense.aggregate({ where, _sum: { amount: true }, _count: true }),
  ]);

  return {
    tenant: { name: business.name, currency },
    categories: distinctCats.map((c) => c.category).filter(Boolean),
    filters: { category, from, to, q },
    summary: { count: agg._count, total: money(Number(agg._sum.amount ?? 0), currency) },
    expenses: rows.map((e) => ({
      id: e.id,
      category: e.category,
      description: e.description ?? "—",
      amount: money(Number(e.amount), currency),
      when: longDate(e.incurredAt),
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

  const [payments, expenses, recentPayments, recentExpenses, outstandingAgg] = await Promise.all([
    prisma.payment.findMany({
      where: { businessId: business.id, status: "SUCCESS", createdAt: { gte: since60 } },
      select: { amount: true, type: true, createdAt: true },
    }),
    prisma.expense.findMany({
      where: { businessId: business.id, incurredAt: { gte: since60 } },
      select: { amount: true, incurredAt: true, category: true },
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

  // Expenses grouped by category over the last 30 days, largest first.
  const catMap = new Map<string, number>();
  for (const e of expenses) {
    if (e.incurredAt >= since30) catMap.set(e.category, (catMap.get(e.category) ?? 0) + Number(e.amount));
  }
  const catMax = Math.max(1, ...catMap.values());
  const expensesByCategory: CategoryTotal[] = [...catMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, total]) => ({
      category,
      amount: money(total, currency),
      percent: pct(total, exp30),
      share: pct(total, catMax),
    }));

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
    expensesByCategory,
  };
}
