import { notFound } from "next/navigation";
import { Wallet, ArrowDownRight, Receipt } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatTile, statMetaFor, EmptyState, Badge } from "@/components/ui";
import { getFinanceData } from "@/lib/finance-data";
import { requireTenantAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

type FinancePageProps = { params: Promise<{ businessSlug: string }> };

export default async function FinancePage({ params }: FinancePageProps) {
  const { businessSlug } = await params;
  await requireTenantAccess(businessSlug);
  const data = await getFinanceData(businessSlug);
  if (!data) notFound();

  return (
    <div className="grid gap-5">
      <PageHeader title="Finance" description="Money in and out — revenue, expenses, and what you're owed." />

      <section className="grid grid-cols-4 gap-4 max-[1080px]:grid-cols-2 max-[640px]:grid-cols-1">
        {data.kpis.map((stat) => {
          const meta = statMetaFor(stat.label);
          return <StatTile key={stat.label} label={stat.label} value={stat.value} detail={stat.detail} icon={meta.icon} tone={meta.tone} />;
        })}
      </section>

      <section className="card p-5">
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
