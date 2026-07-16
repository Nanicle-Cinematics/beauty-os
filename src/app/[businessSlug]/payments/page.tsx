import { Coins } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Combobox } from "@/components/combobox";
import { SubmitButton } from "@/components/submit-button";
import { StatTile, statMetaFor, EmptyState, Badge, toneForStatus } from "@/components/ui";
import { notFound } from "next/navigation";
import { recordPaymentAction } from "@/lib/payment-actions";
import { getPaymentModuleData } from "@/lib/payment-data";
import { requireTenantAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

type PaymentsPageProps = {
  params: Promise<{
    businessSlug: string;
  }>;
};

export default async function PaymentsPage({ params }: PaymentsPageProps) {
  const { businessSlug } = await params;
  await requireTenantAccess(businessSlug);
  const data = await getPaymentModuleData(businessSlug);

  if (!data) {
    notFound();
  }

  return (
    <div className="grid gap-5">
      <PageHeader title="Payments" description="Money in — deposits, checkouts, and outstanding balances." />

        <section className="grid grid-cols-4 gap-4 max-[1080px]:grid-cols-2 max-[640px]:grid-cols-1">
          {data.stats.map((stat) => {
            const meta = statMetaFor(stat.label);
            return (
              <StatTile key={stat.label} label={stat.label} value={stat.value} detail={stat.detail} icon={meta.icon} tone={meta.tone} />
            );
          })}
        </section>

        <section className="grid grid-cols-[minmax(0,1fr)_380px] gap-5 max-[1080px]:grid-cols-1">
          <div className="grid gap-5">
            {data.depositsDue.length > 0 ? (
              <div className="rounded-[20px] border border-warning/25 bg-warning-soft p-5 shadow-[var(--shadow-soft)]">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
                  <Coins size={18} className="text-warning" /> Awaiting deposit
                </h2>
                <p className="mt-1 text-sm text-muted">Collect the deposit in one click (records a cash payment).</p>
                <div className="mt-4 grid gap-2">
                  {data.depositsDue.map((deposit) => (
                    <div key={deposit.appointmentId} className="flex items-center justify-between gap-3 rounded-xl border border-warning/20 bg-card px-4 py-3 text-sm">
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
                          <button className="rounded-xl bg-gradient-to-r from-plum to-wine px-3 py-2 text-xs font-semibold text-white">
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
                <EmptyState icon={Coins} title="No payments yet" body="Record your first payment from the panel on the right." />
              ) : (
                <div className="overflow-hidden rounded-2xl border border-line">
                  <div className="grid grid-cols-[1.3fr_1fr_120px_110px_90px] bg-plum-soft px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted max-[940px]:hidden">
                    <span>Client</span><span>Method</span><span>Type</span><span>Amount</span><span>Status</span>
                  </div>
                  {data.payments.map((payment) => (
                    <div key={payment.id} className="grid grid-cols-[1.3fr_1fr_120px_110px_90px] items-center gap-3 border-t border-line-2 px-4 py-4 text-sm max-[940px]:grid-cols-1">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{payment.client}</div>
                        <div className="text-xs font-semibold text-muted">{payment.when}</div>
                      </div>
                      <span className="font-medium text-muted">{payment.method}</span>
                      <span className="font-medium text-ink">{payment.type}</span>
                      <span className={`font-semibold ${payment.isRefund ? "text-danger" : "text-ink"}`}>{payment.amount}</span>
                      <Badge tone={toneForStatus(payment.status)}>{payment.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <form action={recordPaymentAction} className="card p-5">
            <h2 className="text-lg font-semibold">Record payment</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Marks the payment successful and updates client balances.
            </p>

            <input type="hidden" name="businessSlug" value={businessSlug} />

            <div className="mt-5 grid gap-4">
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
                Amount
                <input name="amount" type="number" min="0" step="0.01" className="input" required />
              </label>

              <div className="grid grid-cols-2 gap-3">
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

              <SubmitButton className="rounded-2xl bg-gradient-to-r from-plum to-wine px-4 py-3 text-sm font-semibold text-white" pendingText="Recording…">
                Record payment
              </SubmitButton>
            </div>
          </form>
        </section>
    </div>
  );
}
