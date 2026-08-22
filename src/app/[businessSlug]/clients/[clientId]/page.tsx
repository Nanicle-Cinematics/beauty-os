import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Archive, ArchiveRestore, Trash2, ShieldAlert, FileText } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui";
import { getClientDetail, getClientFavoriteOptions } from "@/lib/client-data";
import {
  updateClientAction,
  setClientArchivedAction,
  deleteClientAction,
} from "@/lib/client-actions";
import { requireTenantAccess } from "@/lib/auth";
import { membershipIn, roleCan } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type ClientDetailPageProps = {
  params: Promise<{ businessSlug: string; clientId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function ClientDetailPage({ params, searchParams }: ClientDetailPageProps) {
  const { businessSlug, clientId } = await params;
  const { error } = await searchParams;
  const user = await requireTenantAccess(businessSlug, { module: "clients" });

  const [client, favorites, membership] = await Promise.all([
    getClientDetail(businessSlug, clientId),
    getClientFavoriteOptions(businessSlug),
    membershipIn(user, businessSlug),
  ]);
  if (!client || !favorites) notFound();

  const canEdit = roleCan(membership?.role, "clients:edit");
  const canArchive = roleCan(membership?.role, "clients:archive");
  const canDelete = roleCan(membership?.role, "clients:delete");
  const fullName = [client.firstName, client.lastName].filter(Boolean).join(" ");

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5">
      <PageHeader title={fullName} description="View and update this client's details.">
        <Link
          href={`/${businessSlug}/clients`}
          className="inline-flex items-center gap-1.5 rounded-xl border border-line px-4 py-2 text-sm font-medium text-muted hover:bg-sunken"
        >
          <ArrowLeft size={15} /> Back
        </Link>
      </PageHeader>

      {error ? (
        <div className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </div>
      ) : null}

      {client.archived ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/20 bg-warning-soft px-4 py-3">
          <Badge tone="warning">Archived</Badge>
          <span className="text-[13px] font-medium text-warning">
            This client is hidden from your working list. Their history is kept.
          </span>
        </div>
      ) : null}

      {!canEdit ? (
        <div className="flex items-center gap-2.5 rounded-[18px] border border-white/60 bg-white/42 px-4 py-3 text-[13px] font-medium text-muted">
          <ShieldAlert size={15} className="shrink-0 text-faint" />
          Your role can view this client but not change their details.
        </div>
      ) : null}

      {/* Summary — money is derived, never editable by hand. */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Visits", value: String(client.appointmentCount) },
          { label: "Payments", value: String(client.paymentCount) },
          { label: "Invoices", value: String(client.invoiceCount) },
          { label: "Lifetime spend", value: client.lifetimeSpend },
          { label: "Invoice balance", value: client.invoiceBalance },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{s.label}</div>
            <div className="mt-1.5 text-[19px] font-semibold tracking-tight text-ink">{s.value}</div>
          </div>
        ))}
      </section>

      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-plum" />
            <h2 className="text-[15px] font-semibold">Invoices</h2>
          </div>
          <Link href={`/${businessSlug}/invoices/new`} className="text-[12.5px] font-semibold text-plum hover:underline">
            New invoice
          </Link>
        </div>
        {client.invoices.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No invoices for this client yet.</p>
        ) : (
          <div className="mt-4 glass-panel overflow-hidden rounded-[26px]">
            {client.invoices.map((invoice) => (
              <Link
                key={invoice.id}
                href={`/${businessSlug}/invoices/${invoice.id}`}
                className="grid grid-cols-[1fr_110px_110px_100px] items-center gap-3 border-t border-line-2 px-4 py-3 text-sm first:border-t-0 max-[680px]:grid-cols-1"
              >
                <div>
                  <div className="font-semibold text-ink">{invoice.number}</div>
                  <div className="text-xs font-semibold text-muted">Issued {invoice.issued}</div>
                </div>
                <span className="font-semibold text-ink">{invoice.total}</span>
                <span className="font-semibold text-ink">{invoice.balance}</span>
                <Badge>{invoice.status}</Badge>
              </Link>
            ))}
          </div>
        )}
      </section>

      <form action={updateClientAction} className="card grid gap-5 p-5">
        <input type="hidden" name="businessSlug" value={businessSlug} />
        <input type="hidden" name="clientId" value={client.id} />
        <fieldset disabled={!canEdit} className="grid gap-5 disabled:opacity-60">
          <div>
            <h2 className="text-[15px] font-semibold">Contact</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="field-label">
                First name
                <input name="firstName" defaultValue={client.firstName} className="input" required />
              </label>
              <label className="field-label">
                Last name
                <input name="lastName" defaultValue={client.lastName} className="input" />
              </label>
              <label className="field-label">
                Phone
                <input name="phone" defaultValue={client.phone} className="input" placeholder="+233…" />
              </label>
              <label className="field-label">
                Email
                <input name="email" type="email" defaultValue={client.email} className="input" />
              </label>
              <label className="field-label">
                Address
                <input name="addressLine1" defaultValue={client.addressLine1} className="input" />
              </label>
              <label className="field-label">
                City
                <input name="city" defaultValue={client.city} className="input" />
              </label>
              <label className="field-label">
                Birthday
                <input name="birthdate" type="date" defaultValue={client.birthdate} className="input" />
              </label>
              <label className="field-label">
                Anniversary
                <input name="anniversaryDate" type="date" defaultValue={client.anniversaryDate} className="input" />
              </label>
            </div>
          </div>

          <div className="border-t border-line-2 pt-5">
            <h2 className="text-[15px] font-semibold">Care notes</h2>
            <p className="mt-0.5 text-[12.5px] text-muted">
              Allergies are safety information — keep them current.
            </p>
            <div className="mt-3 grid gap-4">
              <label className="field-label">
                Allergies
                <textarea name="allergies" defaultValue={client.allergies} rows={2} className="input" />
              </label>
              <label className="field-label">
                Skin / hair notes
                <textarea name="skinNotes" defaultValue={client.skinNotes} rows={2} className="input" />
              </label>
              <label className="field-label">
                Tags
                <input name="tags" defaultValue={client.tags} className="input" placeholder="VIP, bridal, repeat" />
                <span className="mt-1 block text-[11.5px] font-normal text-faint">Separate with commas.</span>
              </label>
            </div>
          </div>

          <div className="border-t border-line-2 pt-5">
            <h2 className="text-[15px] font-semibold">Preferences</h2>
            <p className="mt-0.5 text-[12.5px] text-muted">Their usual — so the front desk can rebook them fast.</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="field-label">
                Favourite service
                <select name="favoriteServiceId" defaultValue={client.favoriteServiceId} className="input">
                  <option value="">No preference</option>
                  {favorites.services.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                Favourite staff
                <select name="favoriteStaffId" defaultValue={client.favoriteStaffId} className="input">
                  <option value="">No preference</option>
                  {favorites.staff.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="border-t border-line-2 pt-5">
            <h2 className="text-[15px] font-semibold">Marketing consent</h2>
            <p className="mt-0.5 text-[12.5px] text-muted">
              Unticking a channel stops campaigns to this client on it.
            </p>
            <div className="mt-3 grid gap-2.5">
              {[
                { name: "marketingOptInEmail", label: "Email", checked: client.marketingOptInEmail },
                { name: "marketingOptInSms", label: "SMS", checked: client.marketingOptInSms },
                { name: "marketingOptInWhatsapp", label: "WhatsApp", checked: client.marketingOptInWhatsapp },
              ].map((c) => (
                <label
                  key={c.name}
                  className="flex items-center gap-2.5 rounded-xl border border-line-2 bg-sunken px-3.5 py-2.5 text-[13px] font-medium"
                >
                  <input type="checkbox" name={c.name} defaultChecked={c.checked} className="size-4 accent-[var(--plum)]" />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          {canEdit ? (
            <div className="flex flex-wrap gap-2.5 border-t border-line-2 pt-5">
              <SubmitButton
                className="rounded-2xl primary-action px-5 py-3 text-sm font-semibold text-white"
                pendingText="Saving…"
              >
                Save changes
              </SubmitButton>
              <Link
                href={`/${businessSlug}/clients`}
                className="rounded-2xl border border-line px-5 py-3 text-sm font-semibold text-muted hover:bg-sunken"
              >
                Cancel
              </Link>
            </div>
          ) : null}
        </fieldset>
      </form>

      {canArchive || canDelete ? (
        <section className="card border-danger/15 p-5">
          <h2 className="text-[15px] font-semibold">Danger zone</h2>
          <p className="mt-0.5 text-[12.5px] leading-5 text-muted">
            {client.historyCount > 0
              ? `This client has ${client.appointmentCount} booking${client.appointmentCount === 1 ? "" : "s"}, ${client.paymentCount} payment${client.paymentCount === 1 ? "" : "s"}, and ${client.invoiceCount} invoice${client.invoiceCount === 1 ? "" : "s"} on file, so they can only be archived — deleting would remove that history.`
              : "This client has no bookings or payments, so they can be deleted outright."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {canArchive ? (
              <form action={setClientArchivedAction}>
                <input type="hidden" name="businessSlug" value={businessSlug} />
                <input type="hidden" name="clientId" value={client.id} />
                <input type="hidden" name="archived" value={client.archived ? "false" : "true"} />
                <SubmitButton
                  className="inline-flex items-center gap-1.5 rounded-xl border border-line px-4 py-2.5 text-[13px] font-semibold text-ink hover:bg-sunken"
                  pendingText="Working…"
                >
                  {client.archived ? (
                    <>
                      <ArchiveRestore size={14} /> Restore client
                    </>
                  ) : (
                    <>
                      <Archive size={14} /> Archive client
                    </>
                  )}
                </SubmitButton>
              </form>
            ) : null}

            {canDelete && client.historyCount === 0 ? (
              <form action={deleteClientAction}>
                <input type="hidden" name="businessSlug" value={businessSlug} />
                <input type="hidden" name="clientId" value={client.id} />
                <SubmitButton
                  className="inline-flex items-center gap-1.5 rounded-xl border border-danger/25 bg-danger-soft px-4 py-2.5 text-[13px] font-semibold text-danger hover:bg-danger hover:text-white"
                  pendingText="Deleting…"
                >
                  <Trash2 size={14} /> Delete permanently
                </SubmitButton>
              </form>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
