import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, Ban, Undo2, Lock } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { Badge, toneForStatus } from "@/components/ui";
import { getPaymentDetail } from "@/lib/payment-data";
import { updatePaymentMetaAction, voidPaymentAction, refundPaymentAction } from "@/lib/payment-actions";
import { requireTenantAccess } from "@/lib/auth";
import { membershipIn, roleCan } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ businessSlug: string; paymentId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function PaymentDetailPage({ params, searchParams }: Props) {
  const { businessSlug, paymentId } = await params;
  const { error } = await searchParams;
  const user = await requireTenantAccess(businessSlug);

  const [payment, membership] = await Promise.all([
    getPaymentDetail(businessSlug, paymentId),
    membershipIn(user, businessSlug),
  ]);
  if (!payment) notFound();

  const canEdit = roleCan(membership?.role, "payments:edit");
  const canVoid = roleCan(membership?.role, "payments:void");
  const canRefund = roleCan(membership?.role, "payments:refund");
  const symbol = payment.currency === "GHS" ? "GH₵" : payment.currency;

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-5">
      <PageHeader title={`${payment.isRefund ? "−" : ""}${payment.amount}`} description={`${payment.type} · ${payment.method}`}>
        <Link href={`/${businessSlug}/payments`} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-4 py-2 text-sm font-medium text-muted hover:bg-sunken">
          <ArrowLeft size={15} /> Back
        </Link>
      </PageHeader>

      {error ? (
        <div className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">{error}</div>
      ) : null}

      {/* The transaction itself — immutable. Money, method and type are what
          happened; they're never edited, only offset or voided. */}
      <section className="card p-5">
        <div className="flex items-center gap-2">
          <Lock size={15} className="text-faint" />
          <h2 className="text-[15px] font-semibold">Transaction</h2>
          <Badge tone={toneForStatus(payment.status)}>{payment.status}</Badge>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Amount", value: `${payment.isRefund ? "−" : ""}${payment.amount}` },
            { label: "Type", value: payment.type },
            { label: "Method", value: payment.method },
            { label: "Client", value: payment.clientName },
          ].map((f) => (
            <div key={f.label}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{f.label}</div>
              <div className="mt-1 text-[14px] font-semibold text-ink">{f.value}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11.5px] text-faint">
          A completed transaction is never edited. To correct it, void it or issue a refund below — both keep the record.
        </p>
      </section>

      {!canEdit ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-line bg-sunken px-4 py-3 text-[13px] font-medium text-muted">
          <ShieldAlert size={15} className="shrink-0 text-faint" /> Your role can view this payment but not change it.
        </div>
      ) : null}

      {/* Metadata — safe to correct, no money moves. */}
      <form action={updatePaymentMetaAction} className="card grid gap-4 p-5">
        <input type="hidden" name="businessSlug" value={businessSlug} />
        <input type="hidden" name="paymentId" value={payment.id} />
        <h2 className="text-[15px] font-semibold">Details</h2>
        <fieldset disabled={!canEdit} className="grid gap-4 disabled:opacity-60">
          <label className="field-label">
            Reference
            <input name="reference" defaultValue={payment.reference} className="input" placeholder="Provider / transaction reference" />
          </label>
          <label className="field-label">
            Linked appointment
            <select name="appointmentId" defaultValue={payment.appointmentId} className="input">
              <option value="">Not linked</option>
              {payment.appointments.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Note
            <textarea name="note" defaultValue={payment.note} rows={2} className="input" placeholder="e.g. cash, no reference" />
          </label>
          {canEdit ? (
            <div className="flex flex-wrap gap-2.5 border-t border-line-2 pt-4">
              <SubmitButton className="rounded-2xl bg-gradient-to-r from-plum to-wine px-5 py-3 text-sm font-semibold text-white" pendingText="Saving…">Save details</SubmitButton>
              <Link href={`/${businessSlug}/payments`} className="rounded-2xl border border-line px-5 py-3 text-sm font-semibold text-muted hover:bg-sunken">Cancel</Link>
            </div>
          ) : null}
        </fieldset>
      </form>

      {/* Refund — an offsetting record, capped at what remains refundable. */}
      {canRefund && payment.canRefund ? (
        <section className="card p-5">
          <div className="flex items-center gap-2">
            <Undo2 size={15} className="text-plum" />
            <h2 className="text-[15px] font-semibold">Refund</h2>
          </div>
          <p className="mt-0.5 text-[12.5px] leading-5 text-muted">
            Creates an offsetting refund record. Up to {payment.refundable} is still refundable on this payment.
          </p>
          <form action={refundPaymentAction} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="businessSlug" value={businessSlug} />
            <input type="hidden" name="paymentId" value={payment.id} />
            <label className="field-label">
              Amount ({symbol})
              <input name="amount" type="number" min="0" step="0.01" max={payment.refundableRaw} defaultValue={payment.refundableRaw} className="input w-[140px]" required />
            </label>
            <label className="field-label flex-1">
              Reason
              <input name="reason" className="input" placeholder="Why is this being refunded?" />
            </label>
            <SubmitButton className="rounded-xl border border-line px-4 py-2.5 text-[13px] font-semibold text-ink hover:bg-sunken" pendingText="Refunding…">
              Issue refund
            </SubmitButton>
          </form>
        </section>
      ) : null}

      {/* Void — for a payment recorded in error. Keeps the row, drops it from totals. */}
      {canVoid && payment.canVoid ? (
        <section className="card border-danger/15 p-5">
          <div className="flex items-center gap-2">
            <Ban size={15} className="text-danger" />
            <h2 className="text-[15px] font-semibold">Void</h2>
          </div>
          <p className="mt-0.5 text-[12.5px] leading-5 text-muted">
            For a payment recorded in error. The record is kept for the audit trail but removed from your totals.
          </p>
          <form action={voidPaymentAction} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="businessSlug" value={businessSlug} />
            <input type="hidden" name="paymentId" value={payment.id} />
            <label className="field-label flex-1">
              Reason
              <input name="reason" className="input" placeholder="Why is this being voided?" />
            </label>
            <SubmitButton className="rounded-xl border border-danger/25 bg-danger-soft px-4 py-2.5 text-[13px] font-semibold text-danger hover:bg-danger hover:text-white" pendingText="Voiding…">
              Void payment
            </SubmitButton>
          </form>
        </section>
      ) : null}
    </div>
  );
}
