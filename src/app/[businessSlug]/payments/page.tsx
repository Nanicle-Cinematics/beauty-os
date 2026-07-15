import { PageHeader } from "@/components/page-header";
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

const statusStyles: Record<string, string> = {
  SUCCESS: "bg-[#f6edf2] text-[#6d315f]",
  PENDING: "bg-amber-50 text-amber-700",
  FAILED: "bg-rose-50 text-rose-700",
  REFUNDED: "bg-[#f0eaee] text-[#796e77]",
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
          {data.stats.map((stat) => (
            <article key={stat.label} className="card p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#796e77]">
                {stat.label}
              </div>
              <div className="mt-4 text-3xl font-bold tracking-tight">{stat.value}</div>
              <div className="mt-2 text-sm font-semibold text-[#796e77]">{stat.detail}</div>
            </article>
          ))}
        </section>

        <section className="grid grid-cols-[minmax(0,1fr)_380px] gap-5 max-[1080px]:grid-cols-1">
          <div className="grid gap-5">
            {data.depositsDue.length > 0 ? (
              <div className="rounded-[24px] border border-amber-200 bg-amber-50/60 p-5 shadow-[0_12px_35px_rgba(84,33,63,0.06)]">
                <h2 className="text-lg font-semibold">Awaiting deposit</h2>
                <p className="mt-1 text-sm text-[#796e77]">Collect the deposit in one click (records a cash payment).</p>
                <div className="mt-4 grid gap-2">
                  {data.depositsDue.map((deposit) => (
                    <div key={deposit.appointmentId} className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-card px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{deposit.client}</div>
                        <div className="truncate text-xs font-semibold text-[#796e77]">{deposit.service} · {deposit.when}</div>
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
                <p className="mt-1 text-sm text-[#796e77]">Every payment recorded for this business.</p>
              </div>

              {data.payments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#e9dee5] bg-[#f7f2f5] px-4 py-10 text-center text-sm font-semibold text-[#796e77]">
                  No payments recorded yet. Record one from the panel on the right.
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-[#e9dee5]">
                  <div className="grid grid-cols-[1.3fr_1fr_120px_110px_90px] bg-[#f5eff2] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#796e77] max-[940px]:hidden">
                    <span>Client</span><span>Method</span><span>Type</span><span>Amount</span><span>Status</span>
                  </div>
                  {data.payments.map((payment) => (
                    <div key={payment.id} className="grid grid-cols-[1.3fr_1fr_120px_110px_90px] items-center gap-3 border-t border-[#f0e8ed] px-4 py-4 text-sm max-[940px]:grid-cols-1">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{payment.client}</div>
                        <div className="text-xs font-semibold text-[#796e77]">{payment.when}</div>
                      </div>
                      <span className="font-bold text-[#796e77]">{payment.method}</span>
                      <span className="font-bold">{payment.type}</span>
                      <span className={`font-semibold ${payment.isRefund ? "text-rose-700" : ""}`}>{payment.amount}</span>
                      <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[payment.statusKey] ?? "bg-[#f0eaee] text-[#796e77]"}`}>
                        {payment.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <form action={recordPaymentAction} className="card p-5">
            <h2 className="text-lg font-semibold">Record payment</h2>
            <p className="mt-1 text-sm leading-6 text-[#796e77]">
              Marks the payment successful and updates client balances.
            </p>

            <input type="hidden" name="businessSlug" value={businessSlug} />

            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-bold">
                Client
                <select name="customerId" className="h-12 rounded-2xl border border-[#e9dee5] bg-[#f7f2f5] px-4 outline-none focus:border-[#6d315f]">
                  <option value="">— Walk-in —</option>
                  {data.customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>{customer.label}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-bold">
                Appointment (optional)
                <select name="appointmentId" className="h-12 rounded-2xl border border-[#e9dee5] bg-[#f7f2f5] px-4 outline-none focus:border-[#6d315f]">
                  <option value="">— None —</option>
                  {data.appointments.map((appointment) => (
                    <option key={appointment.id} value={appointment.id}>{appointment.label}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-bold">
                Amount
                <input name="amount" type="number" min="0" step="0.01" className="h-12 rounded-2xl border border-[#e9dee5] bg-[#f7f2f5] px-4 outline-none focus:border-[#6d315f]" required />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-2 text-sm font-bold">
                  Method
                  <select name="method" defaultValue="CASH" className="h-12 rounded-2xl border border-[#e9dee5] bg-[#f7f2f5] px-4 outline-none focus:border-[#6d315f]">
                    {data.methods.map((method) => (
                      <option key={method.value} value={method.value}>{method.label}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  Type
                  <select name="type" defaultValue="FULL_PAYMENT" className="h-12 rounded-2xl border border-[#e9dee5] bg-[#f7f2f5] px-4 outline-none focus:border-[#6d315f]">
                    {data.types.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="grid gap-2 text-sm font-bold">
                Reference
                <input name="reference" placeholder="Provider / receipt reference" className="h-12 rounded-2xl border border-[#e9dee5] bg-[#f7f2f5] px-4 outline-none focus:border-[#6d315f]" />
              </label>

              <button className="rounded-2xl bg-gradient-to-r from-plum to-wine px-4 py-3 text-sm font-semibold text-white">
                Record payment
              </button>
            </div>
          </form>
        </section>
    </div>
  );
}
