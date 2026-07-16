import { notFound } from "next/navigation";
import Link from "next/link";
import { Receipt, Filter, ListFilter, Pencil, CheckCircle2, PieChart, Download } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { BreakdownBar } from "@/components/breakdown-bar";
import { EmptyState, Badge } from "@/components/ui";
import { FinanceTabs } from "@/components/finance-tabs";
import { DeleteExpenseButton } from "@/components/delete-expense-button";
import { getExpensesList } from "@/lib/finance-data";
import { requireTenantAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

type ExpensesPageProps = {
  params: Promise<{ businessSlug: string }>;
  searchParams: Promise<{ category?: string; from?: string; to?: string; q?: string; updated?: string; removed?: string }>;
};

export default async function ExpensesPage({ params, searchParams }: ExpensesPageProps) {
  const { businessSlug } = await params;
  const sp = await searchParams;
  await requireTenantAccess(businessSlug);
  const data = await getExpensesList(businessSlug, sp);
  if (!data) notFound();

  const { filters } = data;
  const hasFilters = Boolean(filters.category || filters.from || filters.to || filters.q);

  // Export link carries the currently-applied filters so the CSV matches the view.
  const exportParams = new URLSearchParams();
  if (filters.category) exportParams.set("category", filters.category);
  if (filters.from) exportParams.set("from", filters.from);
  if (filters.to) exportParams.set("to", filters.to);
  if (filters.q) exportParams.set("q", filters.q);
  const exportQuery = exportParams.toString();
  const exportHref = `/${businessSlug}/finance/expenses/export${exportQuery ? `?${exportQuery}` : ""}`;

  return (
    <div className="grid gap-5">
      <PageHeader title="Finance" description="Every expense you've logged — filter by category, date, or keyword." />

      <FinanceTabs businessSlug={businessSlug} active="expenses" />

      {sp.updated ? (
        <div className="flex items-center gap-2 rounded-xl border border-success/20 bg-success-soft px-4 py-3 text-sm font-semibold text-success">
          <CheckCircle2 size={16} /> Expense updated.
        </div>
      ) : null}
      {sp.removed ? (
        <div className="flex items-center gap-2 rounded-xl border border-line bg-sunken px-4 py-3 text-sm font-semibold text-muted">
          <CheckCircle2 size={16} /> Expense deleted.
        </div>
      ) : null}

      <form method="get" className="card grid gap-3 p-4 md:grid-cols-[1.2fr_1fr_1fr_1.4fr_auto] md:items-end">
        <label className="field-label">
          Category
          <select name="category" defaultValue={filters.category} className="input">
            <option value="">All categories</option>
            {data.categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field-label">
          From
          <input name="from" type="date" defaultValue={filters.from} className="input" />
        </label>
        <label className="field-label">
          To
          <input name="to" type="date" defaultValue={filters.to} className="input" />
        </label>
        <label className="field-label">
          Search
          <input name="q" defaultValue={filters.q} placeholder="Description keyword" className="input" />
        </label>
        <div className="flex gap-2">
          <button className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-gradient-to-r from-plum to-wine px-4 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(84,33,63,0.28)]">
            <Filter size={15} /> Filter
          </button>
          {hasFilters ? (
            <Link href={`/${businessSlug}/finance/expenses`} className="inline-flex h-11 items-center rounded-xl border border-line px-4 text-sm font-medium text-muted hover:bg-sunken">
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      {data.byCategory.length > 0 ? (
        <div className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-[15px] font-semibold"><PieChart size={17} className="text-plum" /> By category</h2>
              <p className="mt-0.5 text-[12.5px] text-muted">{hasFilters ? "Totals for the current filters." : "Totals across all expenses."}</p>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted">Total</div>
              <div className="text-[16px] font-semibold text-ink">{data.summary.total}</div>
            </div>
          </div>
          <div className="mt-5 grid gap-x-6 gap-y-3.5 sm:grid-cols-2">
            {data.byCategory.map((c) => (
              <div key={c.category}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-[13px]">
                  <Badge tone="neutral">{c.category}</Badge>
                  <span className="flex items-baseline gap-2">
                    <span className="text-[12px] text-muted">{c.percent}%</span>
                    <span className="font-semibold text-ink">{c.amount}</span>
                  </span>
                </div>
                <BreakdownBar share={c.share} tone="warning" detail={`${c.amount} · ${c.percent}% of expenses`} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-[15px] font-semibold"><ListFilter size={17} className="text-plum" /> Expenses</h2>
            <p className="mt-0.5 text-[12.5px] text-muted">
              {data.summary.count} {data.summary.count === 1 ? "expense" : "expenses"}{hasFilters ? " matching filters" : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {data.expenses.length > 0 ? (
              <a
                href={exportHref}
                download
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-medium text-muted hover:border-plum-line hover:bg-plum-soft hover:text-plum"
              >
                <Download size={15} /> Export CSV
              </a>
            ) : null}
            <div className="text-right">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted">Total</div>
              <div className="text-[18px] font-semibold text-ink">{data.summary.total}</div>
            </div>
          </div>
        </div>

        {data.expenses.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={hasFilters ? "No matching expenses" : "No expenses logged"}
            body={hasFilters ? "Try widening your filters or clearing them." : "Log an expense from the Finance overview to see it here."}
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line">
            <div className="grid grid-cols-[150px_1fr_130px_110px_84px] px-4 py-2.5 data-head max-[720px]:hidden">
              <span>Category</span><span>Description</span><span>Date</span><span>Amount</span><span className="text-right">Actions</span>
            </div>
            {data.expenses.map((e) => (
              <div key={e.id} className="grid grid-cols-[150px_1fr_130px_110px_84px] items-center gap-3 border-t border-line-2 px-4 py-3 text-sm max-[720px]:grid-cols-2">
                <Badge tone="neutral">{e.category}</Badge>
                <span className="truncate text-ink">{e.description}</span>
                <span className="font-medium text-muted">{e.when}</span>
                <span className="font-semibold text-ink">{e.amount}</span>
                <div className="flex items-center justify-end gap-1.5">
                  <Link
                    href={`/${businessSlug}/finance/expenses/${e.id}/edit`}
                    aria-label="Edit expense"
                    className="grid size-8 place-items-center rounded-lg border border-line text-muted hover:border-plum-line hover:bg-plum-soft hover:text-plum"
                  >
                    <Pencil size={15} />
                  </Link>
                  <DeleteExpenseButton businessSlug={businessSlug} expenseId={e.id} label={`${e.category} · ${e.amount}`} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
