import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2, ShieldAlert, Wallet, Clock } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { Combobox } from "@/components/combobox";
import { Badge, toneForStatus } from "@/components/ui";
import { getAppointmentDetail, getAppointmentModuleData } from "@/lib/appointment-data";
import {
  updateAppointmentAction,
  updateAppointmentStatusAction,
  updateHoldSettingsAction,
  firmHoldAction,
  releaseHoldAction,
  deleteAppointmentAction,
} from "@/lib/appointment-actions";
import { requireTenantAccess } from "@/lib/auth";
import { membershipIn, roleCan } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const LIFECYCLE = [
  { label: "Confirm", value: "CONFIRMED" },
  { label: "Complete", value: "COMPLETED" },
  { label: "No-show", value: "NO_SHOW" },
  { label: "Cancel", value: "CANCELLED" },
];

type AppointmentDetailPageProps = {
  params: Promise<{ businessSlug: string; appointmentId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function AppointmentDetailPage({ params, searchParams }: AppointmentDetailPageProps) {
  const { businessSlug, appointmentId } = await params;
  const { error } = await searchParams;
  const user = await requireTenantAccess(businessSlug);

  const [appointment, module, membership] = await Promise.all([
    getAppointmentDetail(businessSlug, appointmentId),
    getAppointmentModuleData(businessSlug),
    membershipIn(user, businessSlug),
  ]);
  if (!appointment || !module) notFound();

  const canEdit = roleCan(membership?.role, "appointments:edit");
  const canDelete = roleCan(membership?.role, "appointments:delete");
  const symbol = appointment.currency === "GHS" ? "GH₵" : appointment.currency;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5">
      <PageHeader title="Booking" description="View, reschedule, and manage this appointment.">
        <Link
          href={`/${businessSlug}/appointments`}
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

      {appointment.isHold && canEdit ? (
        <section className="card border-[#c9d4e6] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-[#4a5b7a]" />
              <h2 className="text-[15px] font-semibold">Hold</h2>
              <Badge tone="info">Provisional</Badge>
            </div>
            {/* Firm/release inline — no need to bounce back to the list. */}
            <div className="flex flex-wrap gap-2">
              <form action={firmHoldAction}>
                <input type="hidden" name="businessSlug" value={businessSlug} />
                <input type="hidden" name="appointmentId" value={appointment.id} />
                <SubmitButton className="rounded-lg border border-plum-line bg-plum-soft px-3 py-1.5 text-[12.5px] font-semibold text-plum hover:bg-plum hover:text-white" pendingText="…">
                  Confirm hold
                </SubmitButton>
              </form>
              <form action={releaseHoldAction}>
                <input type="hidden" name="businessSlug" value={businessSlug} />
                <input type="hidden" name="appointmentId" value={appointment.id} />
                <SubmitButton className="rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium text-muted hover:border-danger/30 hover:bg-danger-soft hover:text-danger" pendingText="…">
                  Release
                </SubmitButton>
              </form>
            </div>
          </div>
          <form action={updateHoldSettingsAction} className="mt-3 flex flex-wrap items-end gap-3 border-t border-line-2 pt-3">
            <input type="hidden" name="businessSlug" value={businessSlug} />
            <input type="hidden" name="appointmentId" value={appointment.id} />
            <label className="field-label">
              Expires
              <input name="holdExpiresAt" type="date" defaultValue={appointment.holdExpiresAtLocal} className="input" />
            </label>
            <label className="field-label">
              Queue position
              <input name="holdPriority" type="number" min="1" step="1" defaultValue={appointment.holdPriority} className="input w-[130px]" placeholder="1" />
            </label>
            <SubmitButton className="rounded-xl border border-line px-4 py-2.5 text-[13px] font-semibold text-ink hover:bg-sunken" pendingText="Saving…">
              Update hold
            </SubmitButton>
          </form>
        </section>
      ) : appointment.isHold ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-[#eef1f6] px-4 py-3">
          <Badge tone="info">Hold</Badge>
          <span className="text-[13px] font-medium text-[#4a5b7a]">This is a provisional hold.</span>
        </div>
      ) : null}

      {!canEdit ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-line bg-sunken px-4 py-3 text-[13px] font-medium text-muted">
          <ShieldAlert size={15} className="shrink-0 text-faint" />
          Your role can view this booking but not change it.
        </div>
      ) : null}

      {/* Money summary — read-only. Booked value (price) is edited below; the
          collected/outstanding figures come from Payment records and are managed
          in the Payments module, never rewritten by editing the booking. */}
      <section className="card p-5">
        <div className="flex items-center gap-2">
          <Wallet size={16} className="text-plum" />
          <h2 className="text-[15px] font-semibold">Payment</h2>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Booked</div>
            <div className="mt-1 text-[17px] font-semibold text-ink">{symbol} {appointment.price}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Collected</div>
            <div className="mt-1 text-[17px] font-semibold text-ink">{appointment.collected}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Outstanding</div>
            <div className="mt-1 text-[17px] font-semibold text-ink">{appointment.outstanding}</div>
          </div>
        </div>
        <Link
          href={`/${businessSlug}/payments`}
          className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-plum hover:gap-1.5"
        >
          Record a payment in Payments →
        </Link>
      </section>

      {/* Lifecycle — separate from the edit form. Status is its own decision. */}
      {canEdit && !appointment.isHold ? (
        <section className="card p-5">
          <h2 className="text-[15px] font-semibold">Status</h2>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[12.5px] text-muted">Currently</span>
            <Badge tone={toneForStatus(appointment.status)}>{appointment.status}</Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {LIFECYCLE.map((option) => (
              <form key={option.value} action={updateAppointmentStatusAction}>
                <input type="hidden" name="businessSlug" value={businessSlug} />
                <input type="hidden" name="appointmentId" value={appointment.id} />
                <input type="hidden" name="status" value={option.value} />
                <button
                  className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-medium ${
                    option.value === "CANCELLED"
                      ? "border-danger/25 text-danger hover:bg-danger-soft"
                      : "border-line text-muted hover:border-plum-line hover:bg-plum-soft hover:text-plum"
                  }`}
                >
                  {option.label}
                </button>
              </form>
            ))}
          </div>
        </section>
      ) : null}

      <form action={updateAppointmentAction} className="card grid gap-5 p-5">
        <input type="hidden" name="businessSlug" value={businessSlug} />
        <input type="hidden" name="appointmentId" value={appointment.id} />
        <fieldset disabled={!canEdit} className="grid gap-5 disabled:opacity-60">
          <div>
            <h2 className="text-[15px] font-semibold">Booking details</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="field-label">
                Client
                <Combobox
                  name="customer"
                  options={module.customers.map((c) => c.label)}
                  defaultValue={appointment.customerName}
                  required
                  placeholder="Search or type a client…"
                />
              </label>
              <label className="field-label">
                Service
                <Combobox
                  name="service"
                  options={module.services.map((s) => s.label)}
                  defaultValue={appointment.serviceName}
                  required
                  placeholder="Search or type a service…"
                />
              </label>
              <label className="field-label">
                Staff
                <select name="staffMemberId" defaultValue={appointment.staffMemberId} className="input" required>
                  {module.staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                Date &amp; time
                <input name="startAtLocal" type="datetime-local" defaultValue={appointment.startAtLocal} className="input" required />
              </label>
              <label className="field-label">
                Price ({symbol})
                <input name="price" type="number" min="0" step="0.01" defaultValue={appointment.price} className="input" />
                <span className="mt-1 block text-[11.5px] font-normal text-faint">
                  Booked value. Changing it never alters money already collected.
                </span>
              </label>
            </div>
          </div>

          <div className="border-t border-line-2 pt-5">
            <label className="field-label">
              Notes
              <textarea name="notes" defaultValue={appointment.notes} rows={3} className="input" placeholder="Anything the team should know for this appointment." />
            </label>
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
                href={`/${businessSlug}/appointments`}
                className="rounded-2xl border border-line px-5 py-3 text-sm font-semibold text-muted hover:bg-sunken"
              >
                Cancel
              </Link>
            </div>
          ) : null}
        </fieldset>
      </form>

      {canDelete ? (
        <section className="card border-danger/15 p-5">
          <h2 className="text-[15px] font-semibold">Danger zone</h2>
          <p className="mt-0.5 text-[12.5px] leading-5 text-muted">
            {appointment.paymentCount > 0
              ? "This booking has payments against it, so it can't be deleted. Cancel it instead to keep the financial record."
              : "This booking has no payments, so it can be deleted outright. To keep it on record, cancel it instead."}
          </p>
          {appointment.paymentCount === 0 ? (
            <form action={deleteAppointmentAction} className="mt-4">
              <input type="hidden" name="businessSlug" value={businessSlug} />
              <input type="hidden" name="appointmentId" value={appointment.id} />
              <SubmitButton
                className="inline-flex items-center gap-1.5 rounded-xl border border-danger/25 bg-danger-soft px-4 py-2.5 text-[13px] font-semibold text-danger hover:bg-danger hover:text-white"
                pendingText="Deleting…"
              >
                <Trash2 size={14} /> Delete permanently
              </SubmitButton>
            </form>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
