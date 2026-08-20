import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { InvoiceFormFields } from "@/components/invoice-form-fields";
import { SubmitButton } from "@/components/submit-button";
import { getInvoiceFormData } from "@/lib/invoice-data";
import { createInvoiceAction } from "@/lib/invoice-actions";
import { requireTenantAccess } from "@/lib/auth";
import { membershipIn, roleCan } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type NewInvoicePageProps = {
  params: Promise<{ businessSlug: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function NewInvoicePage({ params, searchParams }: NewInvoicePageProps) {
  const { businessSlug } = await params;
  const { error } = await searchParams;
  const user = await requireTenantAccess(businessSlug, { module: "invoices" });
  const [data, membership] = await Promise.all([getInvoiceFormData(businessSlug), membershipIn(user, businessSlug)]);
  if (!data) notFound();

  const canCreate = roleCan(membership?.role, "invoices:edit");
  const symbol = data.tenant.currency === "GHS" ? "GH₵" : data.tenant.currency;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5">
      <PageHeader title="New invoice" description="Create a bill from a booking or add one manually.">
        <Link href={`/${businessSlug}/invoices`} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-4 py-2 text-sm font-medium text-muted hover:bg-sunken">
          <ArrowLeft size={15} /> Back
        </Link>
      </PageHeader>

      {error ? (
        <div className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </div>
      ) : null}

      <form action={createInvoiceAction} className="card grid gap-5 p-5">
        <input type="hidden" name="businessSlug" value={businessSlug} />
        <fieldset disabled={!canCreate} className="grid gap-5 disabled:opacity-60">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field-label">
              Invoice number
              <input name="invoiceNumber" defaultValue={data.defaultInvoiceNumber} className="input" required />
            </label>
          </div>

          <InvoiceFormFields
            customers={data.customers.map((customer) => customer.label)}
            appointments={data.appointments.map((appointment) => ({
              id: appointment.id,
              label: appointment.label,
              customerName: appointment.customerName,
              service: appointment.service,
              price: appointment.price,
              dueDate: appointment.dueDate,
            }))}
            currencySymbol={symbol}
          />

          <div className="grid gap-4 border-t border-line-2 pt-5">
            <label className="field-label">
              Notes
              <textarea name="notes" rows={2} className="input" placeholder="Internal or client-facing note" />
            </label>
            <label className="field-label">
              Terms
              <textarea name="terms" rows={2} className="input" placeholder="Payment terms, deposit policy, cancellation notes" />
            </label>
          </div>

          {canCreate ? (
            <div className="flex flex-wrap gap-2.5 border-t border-line-2 pt-5">
              <SubmitButton className="rounded-2xl primary-action px-5 py-3 text-sm font-semibold text-white" pendingText="Creating...">
                Save invoice
              </SubmitButton>
              <Link href={`/${businessSlug}/invoices`} className="rounded-2xl border border-line px-5 py-3 text-sm font-semibold text-muted hover:bg-sunken">
                Cancel
              </Link>
            </div>
          ) : null}
        </fieldset>
      </form>
    </div>
  );
}
