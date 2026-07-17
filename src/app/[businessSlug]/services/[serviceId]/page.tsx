import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Archive, ArchiveRestore, Trash2, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui";
import { getServiceDetail, getServiceFormOptions, formatDuration } from "@/lib/service-data";
import { updateServiceAction, setServiceActiveAction, deleteServiceAction } from "@/lib/service-actions";
import { requireTenantAccess } from "@/lib/auth";
import { membershipIn, roleCan } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type ServiceDetailPageProps = {
  params: Promise<{ businessSlug: string; serviceId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function ServiceDetailPage({ params, searchParams }: ServiceDetailPageProps) {
  const { businessSlug, serviceId } = await params;
  const { error } = await searchParams;
  const user = await requireTenantAccess(businessSlug);

  const [service, options, membership] = await Promise.all([
    getServiceDetail(businessSlug, serviceId),
    getServiceFormOptions(businessSlug),
    membershipIn(user, businessSlug),
  ]);
  if (!service || !options) notFound();

  const canEdit = roleCan(membership?.role, "services:edit");
  const canRetire = roleCan(membership?.role, "services:retire");
  const canDelete = roleCan(membership?.role, "services:delete");
  const symbol = service.currency === "GHS" ? "GH₵" : service.currency;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5">
      <PageHeader title={service.name} description="View and update this service.">
        <Link
          href={`/${businessSlug}/services`}
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

      {!service.isActive ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/20 bg-warning-soft px-4 py-3">
          <Badge tone="warning">Retired</Badge>
          <span className="text-[13px] font-medium text-warning">
            This service is hidden from new bookings. Its history is kept.
          </span>
        </div>
      ) : null}

      {!canEdit ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-line bg-sunken px-4 py-3 text-[13px] font-medium text-muted">
          <ShieldAlert size={15} className="shrink-0 text-faint" />
          Your role can view this service but not change its pricing or setup.
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          { label: "Bookings", value: String(service.bookingCount) },
          { label: "Price", value: `${symbol} ${service.price}` },
          { label: "Duration", value: formatDuration(service.durationMinutes) },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{s.label}</div>
            <div className="mt-1.5 text-[19px] font-semibold tracking-tight text-ink">{s.value}</div>
          </div>
        ))}
      </section>

      <form action={updateServiceAction} className="card grid gap-5 p-5">
        <input type="hidden" name="businessSlug" value={businessSlug} />
        <input type="hidden" name="serviceId" value={service.id} />
        <fieldset disabled={!canEdit} className="grid gap-5 disabled:opacity-60">
          <div>
            <h2 className="text-[15px] font-semibold">Details</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="field-label sm:col-span-2">
                Name
                <input name="name" defaultValue={service.name} className="input" required />
              </label>
              <label className="field-label sm:col-span-2">
                Description
                <textarea name="description" defaultValue={service.description} rows={2} className="input" />
              </label>
              <label className="field-label">
                Category
                <select name="categoryId" defaultValue={service.categoryId} className="input">
                  <option value="">Uncategorised</option>
                  {options.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                Or new category
                <input name="newCategoryName" className="input" placeholder="Type to create" />
              </label>
            </div>
          </div>

          <div className="border-t border-line-2 pt-5">
            <h2 className="text-[15px] font-semibold">Pricing &amp; time</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <label className="field-label">
                Price ({symbol})
                <input name="price" type="number" min="0" step="0.01" defaultValue={service.price} className="input" required />
              </label>
              <label className="field-label">
                Deposit ({symbol})
                <input
                  name="depositAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={service.depositAmount}
                  className="input"
                  placeholder="None"
                />
              </label>
              <label className="field-label">
                Duration (minutes)
                <input
                  name="durationMinutes"
                  type="number"
                  min="1"
                  step="5"
                  defaultValue={service.durationMinutes}
                  className="input"
                  required
                />
              </label>
            </div>
          </div>

          <div className="border-t border-line-2 pt-5">
            <h2 className="text-[15px] font-semibold">Policy &amp; prep</h2>
            <p className="mt-0.5 text-[12.5px] text-muted">
              Your cancellation policy is what justifies keeping a deposit — say it plainly.
            </p>
            <div className="mt-3 grid gap-4">
              <label className="field-label">
                Cancellation policy
                <textarea
                  name="cancellationPolicy"
                  defaultValue={service.cancellationPolicy}
                  rows={2}
                  className="input"
                  placeholder="e.g. Deposits are non-refundable within 48 hours of the appointment."
                />
              </label>
              <label className="field-label">
                Prep instructions
                <textarea
                  name="prepInstructions"
                  defaultValue={service.prepInstructions}
                  rows={2}
                  className="input"
                  placeholder="What the client should do before arriving."
                />
              </label>
              <label className="field-label">
                Calendar colour
                <input name="colorHex" defaultValue={service.colorHex} className="input" placeholder="#6d315f" />
              </label>
            </div>
          </div>

          <div className="border-t border-line-2 pt-5">
            <h2 className="text-[15px] font-semibold">Who can perform it</h2>
            {options.staff.length === 0 ? (
              <p className="mt-2 text-[12.5px] text-muted">No active staff yet.</p>
            ) : (
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {options.staff.map((member) => (
                  <label
                    key={member.id}
                    className="flex items-center gap-2.5 rounded-xl border border-line-2 bg-sunken px-3.5 py-2.5 text-[13px] font-medium"
                  >
                    <input
                      type="checkbox"
                      name="staffIds"
                      value={member.id}
                      defaultChecked={service.staffIds.includes(member.id)}
                      className="size-4 accent-[var(--plum)]"
                    />
                    {member.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          {canEdit ? (
            <div className="flex flex-wrap gap-2.5 border-t border-line-2 pt-5">
              <SubmitButton
                className="rounded-2xl bg-gradient-to-r from-plum to-wine px-5 py-3 text-sm font-semibold text-white"
                pendingText="Saving…"
              >
                Save changes
              </SubmitButton>
              <Link
                href={`/${businessSlug}/services`}
                className="rounded-2xl border border-line px-5 py-3 text-sm font-semibold text-muted hover:bg-sunken"
              >
                Cancel
              </Link>
            </div>
          ) : null}
        </fieldset>
      </form>

      {canRetire || canDelete ? (
        <section className="card border-danger/15 p-5">
          <h2 className="text-[15px] font-semibold">Danger zone</h2>
          <p className="mt-0.5 text-[12.5px] leading-5 text-muted">
            {service.bookingCount > 0
              ? `${service.bookingCount} booking${service.bookingCount === 1 ? " uses" : "s use"} this service, so it can only be retired — deleting would break that history.`
              : "Nothing has booked this service, so it can be deleted outright."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {canRetire ? (
              <form action={setServiceActiveAction}>
                <input type="hidden" name="businessSlug" value={businessSlug} />
                <input type="hidden" name="serviceId" value={service.id} />
                <input type="hidden" name="isActive" value={service.isActive ? "false" : "true"} />
                <SubmitButton
                  className="inline-flex items-center gap-1.5 rounded-xl border border-line px-4 py-2.5 text-[13px] font-semibold text-ink hover:bg-sunken"
                  pendingText="Working…"
                >
                  {service.isActive ? (
                    <>
                      <Archive size={14} /> Retire service
                    </>
                  ) : (
                    <>
                      <ArchiveRestore size={14} /> Restore service
                    </>
                  )}
                </SubmitButton>
              </form>
            ) : null}

            {canDelete && service.bookingCount === 0 ? (
              <form action={deleteServiceAction}>
                <input type="hidden" name="businessSlug" value={businessSlug} />
                <input type="hidden" name="serviceId" value={service.id} />
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
