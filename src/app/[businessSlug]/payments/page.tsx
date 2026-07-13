import Link from "next/link";
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
  SUCCESS: "bg-[#eff7f2] text-[#1d7b5d]",
  PENDING: "bg-amber-50 text-amber-700",
  FAILED: "bg-rose-50 text-rose-700",
  REFUNDED: "bg-[#eef1f0] text-[#6b7c73]",
};

export default async function PaymentsPage({ params }: PaymentsPageProps) {
  const { businessSlug } = await params;
  await requireTenantAccess(businessSlug);
  const data = await getPaymentModuleData(businessSlug);

  if (!data) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#f6f8f6] px-6 py-6 text-[#111b17] max-[720px]:px-3">
      <div className="mx-auto grid max-w-7xl gap-5">
        <header className="flex items-center justify-between gap-4 rounded-3xl border border-[#dbe4de] bg-white px-5 py-4 shadow-[0_18px_45px_rgba(16,38,31,0.08)] max-[720px]:flex-col max-[720px]:items-start">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#1d7b5d]">
              {data.tenant.name}
            </div>
            <h1 className="text-2xl font-black tracking-tight">Payments</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/${businessSlug}`} className="rounded-2xl border border-[#dbe4de] px-4 py-2 text-sm font-black">
              Dashboard
            </Link>
            <Link href={`/${businessSlug}/appointments`} className="rounded-2xl border border-[#dbe4de] px-4 py-2 text-sm font-black">
              Appointments
            </Link>
            <Link href="/logout" className="rounded-2xl border border-[#dbe4de] px-4 py-2 text-sm font-black">
              Sign out
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-4 gap-4 max-[1080px]:grid-cols-2 max-[640px]:grid-cols-1">
          {data.stats.map((stat) => (
            <article key={stat.label} className="rounded-3xl border border-[#dbe4de] bg-white p-5 shadow-[0_12px_35px_rgba(16,38,31,0.05)]">
              <div className="text-xs font-black uppercase tracking-[0.12em] text-[#6b7c73]">
                {stat.label}
              </div>
              <div className="mt-4 text-3xl font-black tracking-tight">{stat.value}</div>
              <div className="mt-2 text-sm font-semibold text-[#6b7c73]">{stat.detail}</div>
            </article>
          ))}
        </section>

        <section className="grid grid-cols-[minmax(0,1fr)_380px] gap-5 max-[1080px]:grid-cols-1">
          <div className="grid gap-5">
            {data.depositsDue.length > 0 ? (
              <div className="rounded-[24px] border border-amber-200 bg-amber-50/60 p-5 shadow-[0_12px_35px_rgba(16,38,31,0.06)]">
                <h2 className="text-lg font-black">Awaiting deposit</h2>
                <p className="mt-1 text-sm text-[#6b7c73]">Collect the deposit in one click (records a cash payment).</p>
                <div className="mt-4 grid gap-2">
                  {data.depositsDue.map((deposit) => (
                    <div key={deposit.appointmentId} className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-black">{deposit.client}</div>
                        <div className="truncate text-xs font-semibold text-[#6b7c73]">{deposit.service} · {deposit.when}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-black">{deposit.amount}</span>
                        <form action={recordPaymentAction}>
                          <input type="hidden" name="businessSlug" value={businessSlug} />
                          <input type="hidden" name="appointmentId" value={deposit.appointmentId} />
                          <input type="hidden" name="customerId" value={deposit.customerId} />
                          <input type="hidden" name="amount" value={deposit.amountRaw} />
                          <input type="hidden" name="method" value="CASH" />
                          <input type="hidden" name="type" value="DEPOSIT" />
                          <button className="rounded-xl bg-[#10261f] px-3 py-2 text-xs font-black text-white">
                            Collect
                          </button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-[24px] border border-[#dbe4de] bg-white p-5 shadow-[0_12px_35px_rgba(16,38,31,0.06)]">
              <div className="mb-4">
                <h2 className="text-lg font-black">Payment history</h2>
                <p className="mt-1 text-sm text-[#6b7c73]">Every payment recorded for this business.</p>
              </div>

              {data.payments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#cdddd4] bg-[#f8faf8] px-4 py-10 text-center text-sm font-semibold text-[#6b7c73]">
                  No payments recorded yet. Record one from the panel on the right.
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-[#dbe4de]">
                  <div className="grid grid-cols-[1.3fr_1fr_120px_110px_90px] bg-[#f2f7f4] px-4 py-3 text-[11px] font-black uppercase tracking-[0.12em] text-[#65766d] max-[940px]:hidden">
                    <span>Client</span><span>Method</span><span>Type</span><span>Amount</span><span>Status</span>
                  </div>
                  {data.payments.map((payment) => (
                    <div key={payment.id} className="grid grid-cols-[1.3fr_1fr_120px_110px_90px] items-center gap-3 border-t border-[#e6eee9] px-4 py-4 text-sm max-[940px]:grid-cols-1">
                      <div className="min-w-0">
                        <div className="truncate font-black">{payment.client}</div>
                        <div className="text-xs font-semibold text-[#6b7c73]">{payment.when}</div>
                      </div>
                      <span className="font-bold text-[#6b7c73]">{payment.method}</span>
                      <span className="font-bold">{payment.type}</span>
                      <span className={`font-black ${payment.isRefund ? "text-rose-700" : ""}`}>{payment.amount}</span>
                      <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${statusStyles[payment.statusKey] ?? "bg-[#eef1f0] text-[#6b7c73]"}`}>
                        {payment.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <form action={recordPaymentAction} className="rounded-[24px] border border-[#dbe4de] bg-white p-5 shadow-[0_12px_35px_rgba(16,38,31,0.06)]">
            <h2 className="text-lg font-black">Record payment</h2>
            <p className="mt-1 text-sm leading-6 text-[#6b7c73]">
              Marks the payment successful and updates client balances.
            </p>

            <input type="hidden" name="businessSlug" value={businessSlug} />

            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-bold">
                Client
                <select name="customerId" className="h-12 rounded-2xl border border-[#dbe4de] bg-[#f8faf8] px-4 outline-none focus:border-[#1d7b5d]">
                  <option value="">— Walk-in —</option>
                  {data.customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>{customer.label}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-bold">
                Appointment (optional)
                <select name="appointmentId" className="h-12 rounded-2xl border border-[#dbe4de] bg-[#f8faf8] px-4 outline-none focus:border-[#1d7b5d]">
                  <option value="">— None —</option>
                  {data.appointments.map((appointment) => (
                    <option key={appointment.id} value={appointment.id}>{appointment.label}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-bold">
                Amount
                <input name="amount" type="number" min="0" step="0.01" className="h-12 rounded-2xl border border-[#dbe4de] bg-[#f8faf8] px-4 outline-none focus:border-[#1d7b5d]" required />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-2 text-sm font-bold">
                  Method
                  <select name="method" defaultValue="CASH" className="h-12 rounded-2xl border border-[#dbe4de] bg-[#f8faf8] px-4 outline-none focus:border-[#1d7b5d]">
                    {data.methods.map((method) => (
                      <option key={method.value} value={method.value}>{method.label}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  Type
                  <select name="type" defaultValue="FULL_PAYMENT" className="h-12 rounded-2xl border border-[#dbe4de] bg-[#f8faf8] px-4 outline-none focus:border-[#1d7b5d]">
                    {data.types.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="grid gap-2 text-sm font-bold">
                Reference
                <input name="reference" placeholder="Provider / receipt reference" className="h-12 rounded-2xl border border-[#dbe4de] bg-[#f8faf8] px-4 outline-none focus:border-[#1d7b5d]" />
              </label>

              <button className="rounded-2xl bg-[#10261f] px-4 py-3 text-sm font-black text-white">
                Record payment
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
