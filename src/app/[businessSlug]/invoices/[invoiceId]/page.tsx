import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ban, CreditCard, FileText, Send } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge, EmptyState, toneForStatus } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { getInvoiceDetail, PAYMENT_METHODS } from "@/lib/invoice-data";
import { sendInvoiceAction, voidInvoiceAction } from "@/lib/invoice-actions";
import { recordPaymentAction } from "@/lib/payment-actions";
import { requireTenantAccess } from "@/lib/auth";
import { membershipIn, roleCan } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type InvoiceDetailPageProps = {
  params: Promise<{ businessSlug: string; invoiceId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function InvoiceDetailPage({ params, searchParams }: InvoiceDetailPageProps) {
  const { businessSlug, invoiceId } = await params;
  const { error } = await searchParams;
  const user = await requireTenantAccess(businessSlug, { module: "invoices" });
  const [invoice, membership] = await Promise.all([getInvoiceDetail(businessSlug, invoiceId), membershipIn(user, businessSlug)]);
  if (!invoice) notFound();

  const canSend = roleCan(membership?.role, "invoices:send");
  const canVoid = roleCan(membership?.role, "invoices:void");
  const canRecordPayment = roleCan(membership?.role, "payments:record");
  const symbol = invoice.currency === "GHS" ? "GH₵" : invoice.currency;

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-5">
      <PageHeader title={invoice.number} description={`${invoice.clientName} · ${invoice.appointmentLabel}`}>
        <Link href={`/${businessSlug}/invoices`} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-4 py-2 text-sm font-medium text-muted hover:bg-sunken">
          <ArrowLeft size={15} /> Back
        </Link>
      </PageHeader>

      {error ? (
        <div className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </div>
      ) : null}

      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line-2 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <FileText size={17} className="text-plum" />
              <h2 className="text-lg font-semibold">Invoice</h2>
              <Badge tone={toneForStatus(invoice.status)}>{invoice.status}</Badge>
            </div>
            <div className="mt-2 text-sm text-muted">Issued {invoice.issuedAt} · Due {invoice.dueDate || "-"}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Balance due</div>
            <div className="mt-1 text-2xl font-semibold text-ink">{invoice.balance}</div>
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          <div className="grid grid-cols-[1fr_80px_120px_120px] gap-3 rounded-xl bg-plum-soft px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted max-[720px]:hidden">
            <span>Description</span><span>Qty</span><span>Unit</span><span>Total</span>
          </div>
          {invoice.lineItems.map((item) => (
            <div key={item.id} className="grid grid-cols-[1fr_80px_120px_120px] gap-3 border-b border-line-2 px-4 py-3 text-sm max-[720px]:grid-cols-1">
              <span className="font-semibold text-ink">{item.description}</span>
              <span className="text-muted"><span className="mr-2 hidden text-[11px] uppercase tracking-[0.1em] text-faint max-[720px]:inline">Qty</span>{item.quantity}</span>
              <span className="text-muted"><span className="mr-2 hidden text-[11px] uppercase tracking-[0.1em] text-faint max-[720px]:inline">Unit</span>{item.unitPrice}</span>
              <span className="font-semibold text-ink"><span className="mr-2 hidden text-[11px] uppercase tracking-[0.1em] text-faint max-[720px]:inline">Total</span>{item.total}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 grid justify-end gap-2 text-sm">
          <div className="grid grid-cols-[120px_140px] gap-3"><span className="text-muted">Subtotal</span><span className="text-right font-semibold">{invoice.subtotal}</span></div>
          <div className="grid grid-cols-[120px_140px] gap-3"><span className="text-muted">Discount</span><span className="text-right font-semibold">{invoice.discount}</span></div>
          <div className="grid grid-cols-[120px_140px] gap-3"><span className="text-muted">Tax</span><span className="text-right font-semibold">{invoice.tax}</span></div>
          <div className="grid grid-cols-[120px_140px] gap-3 border-t border-line-2 pt-2"><span className="text-muted">Total</span><span className="text-right font-semibold">{invoice.total}</span></div>
          <div className="grid grid-cols-[120px_140px] gap-3"><span className="text-muted">Paid</span><span className="text-right font-semibold">{invoice.paid}</span></div>
        </div>

        {invoice.notes || invoice.terms ? (
          <div className="mt-5 grid gap-3 border-t border-line-2 pt-5 text-sm">
            {invoice.notes ? <p><span className="font-semibold text-ink">Notes:</span> <span className="text-muted">{invoice.notes}</span></p> : null}
            {invoice.terms ? <p><span className="font-semibold text-ink">Terms:</span> <span className="text-muted">{invoice.terms}</span></p> : null}
          </div>
        ) : null}
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="card p-5">
          <div className="flex items-center gap-2">
            <CreditCard size={16} className="text-plum" />
            <h2 className="text-[15px] font-semibold">Payments</h2>
          </div>
          {invoice.payments.length === 0 ? (
            <div className="mt-4">
              <EmptyState icon={CreditCard} title="No payments linked" body="Record a payment against this invoice to reduce the balance." />
            </div>
          ) : (
            <div className="mt-4 glass-panel overflow-hidden rounded-2xl">
              {invoice.payments.map((payment) => (
                <Link key={payment.id} href={`/${businessSlug}/payments/${payment.id}`} className="grid grid-cols-[1fr_120px_90px] gap-3 border-t border-line-2 px-4 py-3 text-sm first:border-t-0 max-[620px]:grid-cols-1">
                  <div>
                    <div className="font-semibold text-ink">{payment.type}</div>
                    <div className="text-xs font-semibold text-muted">{payment.method} · {payment.when}</div>
                  </div>
                  <span className={`font-semibold ${payment.isRefund ? "text-danger" : "text-ink"}`}>
                    <span className="mr-2 hidden text-[11px] uppercase tracking-[0.1em] text-faint max-[620px]:inline">Amount</span>{payment.amount}
                  </span>
                  <Badge tone={toneForStatus(payment.status)}>{payment.status}</Badge>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-5">
          {canRecordPayment && invoice.statusKey !== "VOID" && invoice.balanceRaw > 0 ? (
            <form action={recordPaymentAction} className="card grid gap-4 p-5">
              <input type="hidden" name="businessSlug" value={businessSlug} />
              <input type="hidden" name="invoiceId" value={invoice.id} />
              <input type="hidden" name="returnTo" value={`/${businessSlug}/invoices/${invoice.id}`} />
              <input type="hidden" name="customer" value={invoice.clientName} />
              <input type="hidden" name="appointmentId" value="" />
              <h2 className="text-[15px] font-semibold">Record payment</h2>
              <label className="field-label">
                Amount ({symbol})
                <input name="amount" type="number" min="0" step="0.01" max={invoice.balanceRaw} defaultValue={invoice.balanceRaw} className="input" required />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="field-label">
                  Method
                  <select name="method" defaultValue="CASH" className="input">
                    {PAYMENT_METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
                  </select>
                </label>
                <label className="field-label">
                  Type
                  <select name="type" defaultValue="BALANCE" className="input">
                    <option value="BALANCE">Balance</option>
                    <option value="FULL_PAYMENT">Full payment</option>
                    <option value="DEPOSIT">Deposit</option>
                  </select>
                </label>
              </div>
              <label className="field-label">
                Reference
                <input name="reference" className="input" placeholder="Receipt or provider reference" />
              </label>
              <SubmitButton className="rounded-2xl primary-action px-4 py-3 text-sm font-semibold text-white" pendingText="Recording...">
                Record payment
              </SubmitButton>
            </form>
          ) : null}

          <section className="card grid gap-3 p-5">
            <h2 className="text-[15px] font-semibold">Actions</h2>
            {canSend && invoice.statusKey !== "VOID" && invoice.statusKey !== "PAID" ? (
              <form action={sendInvoiceAction}>
                <input type="hidden" name="businessSlug" value={businessSlug} />
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <SubmitButton className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-line px-4 py-2.5 text-[13px] font-semibold text-ink hover:bg-sunken" pendingText="Sending...">
                  <Send size={14} /> Send invoice
                </SubmitButton>
              </form>
            ) : null}

            {canVoid && invoice.statusKey !== "VOID" ? (
              <form action={voidInvoiceAction}>
                <input type="hidden" name="businessSlug" value={businessSlug} />
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <SubmitButton className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-danger/25 bg-danger-soft px-4 py-2.5 text-[13px] font-semibold text-danger hover:bg-danger hover:text-white" pendingText="Voiding...">
                  <Ban size={14} /> Void invoice
                </SubmitButton>
              </form>
            ) : null}
          </section>
        </div>
      </section>
    </div>
  );
}
