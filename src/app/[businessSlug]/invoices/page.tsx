import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState, Badge, StatTile, statMetaFor, toneForStatus } from "@/components/ui";
import { getInvoiceModuleData } from "@/lib/invoice-data";
import { requireTenantAccess } from "@/lib/auth";
import { timeDataLoad } from "@/lib/perf";

export const dynamic = "force-dynamic";

type InvoicesPageProps = {
  params: Promise<{ businessSlug: string }>;
  searchParams: Promise<{ q?: string; status?: string }>;
};

export default async function InvoicesPage({ params, searchParams }: InvoicesPageProps) {
  const { businessSlug } = await params;
  const filters = await searchParams;
  await requireTenantAccess(businessSlug, { module: "invoices" });
  const data = await timeDataLoad(`invoices:${businessSlug}`, () => getInvoiceModuleData(businessSlug, filters));
  if (!data) notFound();

  return (
    <div className="grid gap-5">
      <PageHeader title="Invoices" description="Bill clients, track balances, and keep invoice payments tied to the ledger.">
        <Link
          href={`/${businessSlug}/invoices/new`}
          className="inline-flex items-center gap-1.5 rounded-xl primary-action px-4 py-2 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(84,33,63,0.28)]"
        >
          <Plus size={15} /> New invoice
        </Link>
      </PageHeader>

      <section className="grid grid-cols-4 gap-4 max-[1080px]:grid-cols-2 max-[640px]:grid-cols-1">
        {data.stats.map((stat) => {
          const meta = statMetaFor(stat.label);
          return <StatTile key={stat.label} label={stat.label} value={stat.value} detail={stat.detail} icon={meta.icon} tone={meta.tone} />;
        })}
      </section>

      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Invoice history</h2>
            <p className="mt-1 text-sm text-muted">Drafts, sent invoices, balances, and paid records.</p>
          </div>
          <form className="flex w-full flex-wrap gap-2 sm:w-auto" action={`/${businessSlug}/invoices`}>
            <input name="q" defaultValue={filters.q ?? ""} className="input h-10 min-w-0 flex-1 sm:w-[220px] sm:flex-none" placeholder="Search client or number" />
            <select name="status" defaultValue={filters.status ?? "ALL"} className="input h-10 w-full sm:w-[150px]">
              <option value="ALL">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SENT">Sent</option>
              <option value="PARTIALLY_PAID">Part paid</option>
              <option value="PAID">Paid</option>
              <option value="OVERDUE">Overdue</option>
              <option value="VOID">Void</option>
            </select>
            <button className="w-full rounded-xl border border-line px-4 py-2 text-[13px] font-semibold text-ink hover:bg-sunken sm:w-auto">Filter</button>
          </form>
        </div>

        {data.invoices.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No invoices yet"
            body="Create an invoice from a booking or build one manually."
            action={
              <Link href={`/${businessSlug}/invoices/new`} className="rounded-xl bg-plum px-4 py-2 text-[12.5px] font-semibold text-white">
                New invoice
              </Link>
            }
          />
        ) : (
          <div className="glass-panel overflow-hidden rounded-2xl">
            <div className="grid grid-cols-[120px_1.2fr_1fr_110px_110px_100px] gap-3 bg-plum-soft px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted max-[980px]:hidden">
              <span>No.</span><span>Client</span><span>For</span><span>Total</span><span>Balance</span><span>Status</span>
            </div>
            {data.invoices.map((invoice) => (
              <Link
                key={invoice.id}
                href={`/${businessSlug}/invoices/${invoice.id}`}
                className="grid grid-cols-[120px_1.2fr_1fr_110px_110px_100px] items-center gap-3 border-t border-line-2 px-4 py-4 text-sm transition hover:bg-plum-softer max-[980px]:grid-cols-1"
              >
                <span className="font-semibold text-ink"><span className="mr-2 hidden text-[11px] uppercase tracking-[0.1em] text-faint max-[980px]:inline">No.</span>{invoice.number}</span>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{invoice.client}</div>
                  <div className="text-xs font-semibold text-muted">Issued {invoice.issued} · Due {invoice.due}</div>
                </div>
                <span className="truncate font-medium text-muted"><span className="mr-2 hidden text-[11px] uppercase tracking-[0.1em] text-faint max-[980px]:inline">For</span>{invoice.appointment}</span>
                <span className="font-semibold text-ink"><span className="mr-2 hidden text-[11px] uppercase tracking-[0.1em] text-faint max-[980px]:inline">Total</span>{invoice.total}</span>
                <span className="font-semibold text-ink"><span className="mr-2 hidden text-[11px] uppercase tracking-[0.1em] text-faint max-[980px]:inline">Balance</span>{invoice.balance}</span>
                <Badge tone={toneForStatus(invoice.status)}>{invoice.status}</Badge>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
