import { notFound } from "next/navigation";
import { Wallet, ArrowDownRight, Receipt, Plus, CheckCircle2, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { TrendChart } from "@/components/trend-chart";
import { StatTile, statMetaFor, EmptyState, Badge } from "@/components/ui";
import { FinanceTabs } from "@/components/finance-tabs";
import { getFinanceData } from "@/lib/finance-data";
import { createExpenseAction } from "@/lib/finance-actions";
import { requireTenantAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

const expenseCategories = ["Supplies", "Rent", "Salaries", "Utilities", "Marketing", "Equipment", "Transport", "Maintenance"];

type FinancePageProps = {
  params: Promise<{ businessSlug: string }>;
  searchParams: Promise<{ logged?: string; error?: string }>;
};

export default async function FinancePage({ params, searchParams }: FinancePageProps) {
  const { businessSlug } = await params;
  const { logged, error } = await searchParams;
  await requireTenantAccess(businessSlug);
  const data = await getFinanceData(businessSlug);
  if (!data) notFound();

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="grid gap-5">
      <PageHeader title="Finance" description="Money in and out — revenue, expenses, and what you're owed." />

      <FinanceTabs businessSlug={businessSlug} active="overview" />

      {logged ? (
        <div className="flex items-center gap-2 rounded-xl border border-success/20 bg-success-soft px-4 py-3 text-sm font-semibold text-success">
          <CheckCircle2 size={16} /> Expense logged.
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">{error}</div>
      ) : null}

      <section className="grid grid-cols-4 gap-4 max-[1080px]:grid-cols-2 max-[640px]:grid-cols-1">
        {data.kpis.map((stat) => {
          const meta = statMetaFor(stat.label);
          return <StatTile key={stat.label} label={stat.label} value={stat.value} detail={stat.detail} icon={meta.icon} tone={meta.tone} />;
        })}
      </section>

      <section className="card p-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-xl bg-plum-soft text-plum"><TrendingUp size={16} /></span>
          <div>
            <h2 className="text-[15px] font-semibold">Revenue vs expenses</h2>
            <p className="text-[12px] text-muted">Weekly over the last 6 weeks — hover a week for exact figures.</p>
          </div>
        </div>
        <TrendChart
          height={200}
          ariaLabel="Weekly revenue versus expenses over the last 6 weeks"
          series={[
            { name: "Revenue", color: "var(--plum)", points: data.trend.map((t) => ({ label: t.label, value: t.revenue, display: t.revenueLabel })) },
            { name: "Expenses", color: "var(--warning)", points: data.trend.map((t) => ({ label: t.label, value: t.expenses, display: t.expensesLabel })) },
          ]}
        />
      </section>

      <section className="grid grid-cols-[minmax(0,1fr)_360px] gap-5 max-[1080px]:grid-cols-1">
        <div className="card p-5">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold"><Wallet size={17} className="text-plum" /> Cash flow (30 days)</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">Revenue against expenses, and what&apos;s left.</p>
          <div className="mt-5 grid gap-4">
            <div>
              <div className="mb-1.5 flex justify-between text-[13px]"><span className="font-medium text-muted">Revenue</span><span className="font-semibold text-ink">{data.flow.revenueLabel}</span></div>
              <div className="h-2.5 overflow-hidden rounded-full bg-sunken"><div className="h-full rounded-full bg-gradient-to-r from-plum to-mauve" style={{ width: `${Math.max(data.flow.revenueShare, 2)}%` }} /></div>
            </div>
            <div>
              <div className="mb-1.5 flex justify-between text-[13px]"><span className="font-medium text-muted">Expenses</span><span className="font-semibold text-ink">{data.flow.expensesLabel}</span></div>
              <div className="h-2.5 overflow-hidden rounded-full bg-sunken"><div className="h-full rounded-full bg-warning" style={{ width: `${Math.max(data.flow.expensesShare, 2)}%` }} /></div>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-line-2 bg-plum-softer px-4 py-3">
              <span className="text-[13px] font-semibold text-ink">Net profit</span>
              <span className={`text-[17px] font-semibold ${data.flow.net >= 0 ? "text-success" : "text-danger"}`}>{data.flow.netLabel}</span>
            </div>
          </div>
        </div>

        <form action={createExpenseAction} className="card grid h-fit gap-4 p-5">
          <div>
            <h2 className="flex items-center gap-2 text-[15px] font-semibold"><Plus size={17} className="text-plum" /> Log expense</h2>
            <p className="mt-1 text-[12.5px] leading-5 text-muted">Record a cost — it updates your totals right away.</p>
          </div>

          <input type="hidden" name="businessSlug" value={businessSlug} />

          <label className="field-label">
            Category
            <input name="category" list="expense-categories" placeholder="e.g. Supplies" className="input" required />
            <datalist id="expense-categories">
              {expenseCategories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>

          <div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
            <label className="field-label">
              Amount
              <input name="amount" type="number" min="0" step="0.01" placeholder="0.00" className="input" required />
            </label>
            <label className="field-label">
              Date
              <input name="incurredAt" type="date" defaultValue={today} className="input" />
            </label>
          </div>

          <label className="field-label">
            Description (optional)
            <input name="description" placeholder="What was it for?" className="input" />
          </label>

          <button className="rounded-xl bg-gradient-to-r from-plum to-wine px-4 py-3 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(84,33,63,0.28)]">
            Log expense
          </button>
        </form>
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-[15px] font-semibold"><Receipt size={17} className="text-plum" /> Expenses by category</h2>
            <p className="mt-0.5 text-[12.5px] text-muted">Where your money went over the last 30 days.</p>
          </div>
          {data.expensesByCategory.length > 0 ? (
            <div className="text-right">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted">Total</div>
              <div className="text-[16px] font-semibold text-ink">{data.flow.expensesLabel}</div>
            </div>
          ) : null}
        </div>
        {data.expensesByCategory.length === 0 ? (
          <div className="mt-4"><EmptyState icon={Receipt} title="No expenses in the last 30 days" body="Logged expenses will break down here by category." /></div>
        ) : (
          <div className="mt-5 grid gap-3.5">
            {data.expensesByCategory.map((c) => (
              <div key={c.category}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-[13px]">
                  <Badge tone="neutral">{c.category}</Badge>
                  <span className="flex items-baseline gap-2">
                    <span className="text-[12px] text-muted">{c.percent}%</span>
                    <span className="font-semibold text-ink">{c.amount}</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
                  <div className="h-full rounded-full bg-warning" style={{ width: `${Math.max(c.share, 3)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold"><ArrowDownRight size={17} className="text-plum" /> Recent payments</h2>
          {data.recentPayments.length === 0 ? (
            <div className="mt-4"><EmptyState icon={Wallet} title="No payments yet" body="Recorded payments will appear here." /></div>
          ) : (
            <div className="mt-4 grid gap-2">
              {data.recentPayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-line-2 px-3.5 py-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-ink">{p.client}</div>
                    <div className="truncate text-[12px] text-muted">{p.method} · {p.when}</div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Badge tone={p.isRefund ? "danger" : "neutral"}>{p.type}</Badge>
                    <span className={`font-semibold ${p.isRefund ? "text-danger" : "text-ink"}`}>{p.amount}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold"><Receipt size={17} className="text-plum" /> Recent expenses</h2>
          {data.recentExpenses.length === 0 ? (
            <div className="mt-4"><EmptyState icon={Receipt} title="No expenses logged" body="Track costs to see your true margin." /></div>
          ) : (
            <div className="mt-4 grid gap-2">
              {data.recentExpenses.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 rounded-xl border border-line-2 px-3.5 py-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-ink">{e.category}</div>
                    <div className="truncate text-[12px] text-muted">{e.description} · {e.when}</div>
                  </div>
                  <span className="font-semibold text-ink">{e.amount}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
