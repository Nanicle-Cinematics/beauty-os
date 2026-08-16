import Link from "next/link";
import { Coins, ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Combobox } from "@/components/combobox";
import { SubmitButton } from "@/components/submit-button";
import { statMetaFor, EmptyState, Badge, toneForStatus } from "@/components/ui";
import { notFound } from "next/navigation";
import { recordPaymentAction } from "@/lib/payment-actions";
import { getPaymentModuleData } from "@/lib/payment-data";
import { requireTenantAccess } from "@/lib/auth";
import { timeDataLoad } from "@/lib/perf";

export const dynamic = "force-dynamic";

type PaymentsPageProps = {
  params: Promise<{
    businessSlug: string;
  }>;
  searchParams: Promise<{ new?: string }>;
};

export default async function PaymentsPage({ params, searchParams }: PaymentsPageProps) {
  const { businessSlug } = await params;
  const { new: newParam } = await searchParams;
  const showNew = newParam === "1";
  await requireTenantAccess(businessSlug);
  const data = await timeDataLoad(`payments:${businessSlug}`, () => getPaymentModuleData(businessSlug));

  if (!data) {
    notFound();
  }

  return (
    <div className="grid gap-5">
      <PageHeader title="Payments" description="Money in — deposits, checkouts, and outstanding balances." />

        <section className="grid grid-cols-4 gap-4 max-[1080px]:grid-cols-2 max-[640px]:grid-cols-1">
          {data.stats.map((stat) => {
            const meta = statMetaFor(stat.label);
            const Icon = meta.icon;
            return (
              <details key={stat.label} className="group">
                <summary className="card flex cursor-pointer list-none flex-col gap-3 p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] [&::-webkit-details-marker]:hidden">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-medium text-muted">{stat.label}</span>
                    <span className="icon-chip grid size-9 shrink-0 place-items-center rounded-2xl bg-plum-soft text-plum">
                      <Icon size={16} />
                    </span>
                  </div>
                  <div className="text-[26px] font-semibold tracking-tight text-ink">{stat.value}</div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[12.5px] font-medium text-muted">{stat.detail}</span>
                    <ChevronDown size={15} className="shrink-0 text-faint transition-transform group-open:rotate-180" />
                  </div>
                </summary>
                <div className="glass-panel mt-2 overflow-hidden rounded-[26px]">
                  {stat.clients.length === 0 ? (
                    <div className="px-4 py-3 text-[12.5px] font-medium text-muted">No clients in this total.</div>
                  ) : (
                    stat.clients.map((client) => (
                      <div key={`${stat.label}-${client.client}-${client.amount}`} className="grid grid-cols-[1fr_auto] gap-3 border-t border-white/45 px-4 py-3 text-sm first:border-t-0">
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-ink">{client.client}</div>
                          <div className="truncate text-xs font-semibold text-muted">{client.detail}</div>
                        </div>
                        <span className="font-semibold text-ink">{client.amount}</span>
                      </div>
                    ))
                  )}
                </div>
              </details>
            );
          })}
        </section>

        <section className="grid gap-5">
          <div className="grid gap-5">
            {data.depositsDue.length > 0 ? (
              <div className="glass-panel rounded-[28px] p-5">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
                  <Coins size={18} className="text-warning" /> Awaiting deposit
                </h2>
                <p className="mt-1 text-sm text-muted">Collect the deposit in one click (records a cash payment).</p>
                <div className="mt-4 grid gap-2">
                  {data.depositsDue.map((deposit) => (
                    <div key={deposit.appointmentId} className="flex items-center justify-between gap-3 rounded-[20px] border border-warning/20 bg-warning-soft/60 px-4 py-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.62)]">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{deposit.client}</div>
                        <div className="truncate text-xs font-semibold text-muted">{deposit.service} · {deposit.when}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold">{deposit.amount}</span>
                        <form action={recordPaymentAction}>
                          <input type="hidden" name="businessSlug" value={businessSlug} />
                          <input type="hidden" name="appointmentId" value={deposit.appointmentId} />
                          <input type="hidden" name="customerId" value={deposit.customerId} />
                          <input type="hidden" name="amount" value={deposit.amountRaw} />
                          <input type="hidden" name="method" value="CASH" />
                          <input type="hidden" name="type" value="DEPOSIT" />
                          <button className="primary-action rounded-2xl px-3 py-2 text-xs font-semibold text-white">
                            Collect
                          </button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="card p-5">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Payment history</h2>
                <p className="mt-1 text-sm text-muted">Every payment recorded for this business.</p>
              </div>

              {data.payments.length === 0 ? (
                <EmptyState icon={Coins} title="No payments yet" body="Record your first payment using Record payment below." />
              ) : (
                <div className="glass-panel overflow-hidden rounded-[26px]">
                  <div className="grid grid-cols-[1.3fr_1fr_120px_110px_90px] gap-3 bg-white/44 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted max-[940px]:hidden">
                    <span>Client</span><span>Method</span><span>Type</span><span>Amount</span><span>Status</span>
                  </div>
                  {data.payments.map((payment) => (
                    <Link
                      key={payment.id}
                      href={`/${businessSlug}/payments/${payment.id}`}
                      className="grid grid-cols-[1.3fr_1fr_120px_110px_90px] items-center gap-3 border-t border-white/45 px-4 py-4 text-sm transition hover:bg-white/52 max-[940px]:grid-cols-1"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{payment.client}</div>
                        <div className="text-xs font-semibold text-muted">{payment.when}</div>
                      </div>
                      <span className="font-medium text-muted">{payment.method}</span>
                      <span className="font-medium text-ink">{payment.type}</span>
                      <span className={`font-semibold ${payment.isRefund ? "text-danger" : "text-ink"}`}>{payment.amount}</span>
                      <Badge tone={toneForStatus(payment.status)}>{payment.status}</Badge>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          <details id="record-payment" open={showNew} className="group card overflow-hidden p-0">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden">
              <div>
                <h2 className="text-lg font-semibold">Record payment</h2>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Marks the payment successful and updates client balances.
                </p>
              </div>
              <ChevronDown size={18} className="shrink-0 text-muted transition-transform group-open:rotate-180" />
            </summary>
            <form action={recordPaymentAction} className="grid gap-4 border-t border-white/45 bg-white/24 p-5">
              <input type="hidden" name="businessSlug" value={businessSlug} />
              <label className="field-label">
                Client
                <Combobox name="customer" options={data.customers.map((customer) => customer.label)} placeholder="Walk-in — or search / type a client…" />
              </label>

              <label className="field-label">
                Appointment (optional)
                <select name="appointmentId" className="input">
                  <option value="">— None —</option>
                  {data.appointments.map((appointment) => (
                    <option key={appointment.id} value={appointment.id}>{appointment.label}</option>
                  ))}
                </select>
              </label>

              <label className="field-label">
                Invoice (optional)
                <select name="invoiceId" className="input">
                  <option value="">— None —</option>
                  {data.invoices.map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>{invoice.label}</option>
                  ))}
                </select>
              </label>

              <label className="field-label">
                Amount
                <input name="amount" type="number" min="0" step="0.01" className="input" required />
              </label>

              <div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
                <label className="field-label">
                  Method
                  <select name="method" defaultValue="CASH" className="input">
                    {data.methods.map((method) => (
                      <option key={method.value} value={method.value}>{method.label}</option>
                    ))}
                  </select>
                </label>
                <label className="field-label">
                  Type
                  <select name="type" defaultValue="FULL_PAYMENT" className="input">
                    {data.types.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="field-label">
                Reference
                <input name="reference" placeholder="Provider / receipt reference" className="input" />
              </label>

              <SubmitButton className="rounded-2xl primary-action px-4 py-3 text-sm font-semibold text-white" pendingText="Recording…">
                Record payment
              </SubmitButton>
            </form>
          </details>
        </section>
    </div>
  );
}
