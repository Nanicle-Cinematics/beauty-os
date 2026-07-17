import { CalendarPlus, BookmarkPlus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Combobox } from "@/components/combobox";
import { SubmitButton } from "@/components/submit-button";
import { Badge, toneForStatus, EmptyState, Avatar } from "@/components/ui";
import { notFound } from "next/navigation";
import {
  createAppointmentAction,
  updateAppointmentStatusAction,
  firmHoldAction,
  releaseHoldAction,
} from "@/lib/appointment-actions";
import { getAppointmentModuleData } from "@/lib/appointment-data";
import { requireTenantAccess } from "@/lib/auth";

type AppointmentsPageProps = {
  params: Promise<{
    businessSlug: string;
  }>;
};

const statusOptions = [
  { label: "Confirm", value: "CONFIRMED" },
  { label: "Complete", value: "COMPLETED" },
  { label: "No-show", value: "NO_SHOW" },
  { label: "Cancel", value: "CANCELLED" },
];

export default async function AppointmentsPage({ params }: AppointmentsPageProps) {
  const { businessSlug } = await params;
  await requireTenantAccess(businessSlug);
  const data = await getAppointmentModuleData(businessSlug);

  if (!data) {
    notFound();
  }

  return (
    <div className="grid gap-5">
      <PageHeader title="Appointments" description="Every booking for this business — confirm, complete, and keep the day flowing." />

        <section className="grid grid-cols-[minmax(0,1fr)_360px] gap-5 max-[1080px]:grid-cols-1">
          <div className="card p-5">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Schedule</h2>
              <p className="mt-1 text-sm text-muted">
                Tenant-scoped appointment records for this business only.
              </p>
            </div>

            {data.appointments.length === 0 ? (
              <EmptyState icon={CalendarPlus} title="No appointments yet" body="Create your first booking from the panel on the right." />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-line">
                <div className="grid grid-cols-[82px_1fr_1fr_130px_110px_220px] px-4 py-2.5 data-head max-[940px]:hidden">
                  <span>Time</span><span>Client</span><span>Service</span><span>Status</span><span>Value</span><span>Actions</span>
                </div>
                {data.appointments.map((appointment) => (
                  <div key={appointment.id} className="grid grid-cols-[82px_1fr_1fr_130px_110px_220px] items-center gap-3 border-t border-line-2 px-4 py-3.5 text-sm max-[940px]:grid-cols-1">
                    <span className="font-semibold text-plum">{appointment.time}</span>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={appointment.client} size={30} />
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-ink">{appointment.client}</div>
                        <div className="mt-0.5 truncate text-xs text-muted">{appointment.staff}</div>
                      </div>
                    </div>
                    <span className="font-medium text-ink">{appointment.service}</span>
                    <div className="grid gap-1">
                      <Badge tone={toneForStatus(appointment.status)}>{appointment.status}</Badge>
                      {appointment.holdExpiryLabel ? (
                        <span className={`text-[11px] font-medium ${appointment.holdExpired ? "text-danger" : "text-faint"}`}>
                          {appointment.holdExpiryLabel}
                        </span>
                      ) : null}
                    </div>
                    <span className={`font-semibold ${appointment.isHold ? "text-faint" : "text-ink"}`}>
                      {appointment.value}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {appointment.isHold ? (
                        <>
                          <form action={firmHoldAction}>
                            <input type="hidden" name="businessSlug" value={businessSlug} />
                            <input type="hidden" name="appointmentId" value={appointment.id} />
                            <button className="rounded-lg border border-plum-line bg-plum-soft px-2.5 py-1.5 text-xs font-semibold text-plum hover:bg-plum hover:text-white">
                              Confirm hold
                            </button>
                          </form>
                          <form action={releaseHoldAction}>
                            <input type="hidden" name="businessSlug" value={businessSlug} />
                            <input type="hidden" name="appointmentId" value={appointment.id} />
                            <button className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-muted hover:border-danger/30 hover:bg-danger-soft hover:text-danger">
                              Release
                            </button>
                          </form>
                        </>
                      ) : (
                        statusOptions.map((option) => (
                          <form key={option.value} action={updateAppointmentStatusAction}>
                            <input type="hidden" name="businessSlug" value={businessSlug} />
                            <input type="hidden" name="appointmentId" value={appointment.id} />
                            <input type="hidden" name="status" value={option.value} />
                            <button className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-muted hover:border-plum-line hover:bg-plum-soft hover:text-plum">
                              {option.label}
                            </button>
                          </form>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form action={createAppointmentAction} className="card p-5">
            <h2 className="text-lg font-semibold">Create booking</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Books {data.tenant.name} — or holds the date provisionally if the client hasn&apos;t committed yet.
            </p>

            <input type="hidden" name="businessSlug" value={businessSlug} />

            <div className="mt-5 grid gap-4">
              <label className="field-label">
                Client
                <Combobox name="customer" options={data.customers.map((customer) => customer.label)} required placeholder="Search or type a new client…" />
              </label>

              <label className="field-label">
                Service
                <Combobox name="service" options={data.services.map((service) => service.label)} required placeholder="Search or type a new service…" />
              </label>

              <label className="field-label">
                Price (optional)
                <input name="price" type="number" min="0" step="0.01" placeholder="Uses the service price if blank" className="input" />
              </label>

              <label className="field-label">
                Staff
                <select name="staffMemberId" className="input" required>
                  {data.staff.map((person) => (
                    <option key={person.id} value={person.id}>{person.label}</option>
                  ))}
                </select>
              </label>

              <label className="field-label">
                Start time
                <input
                  name="startAt"
                  type="datetime-local"
                  defaultValue="2026-07-13T14:00"
                  className="input"
                  required
                />
              </label>

              {/* Checkbox first so the label and the expiry field are following
                  siblings — that's what lets peer-checked reveal the field with
                  no client JS, keeping this a server component. */}
              <div className="grid gap-2">
                <input id="hold" name="hold" type="checkbox" className="peer sr-only" />
                <label
                  htmlFor="hold"
                  className="flex cursor-pointer items-center gap-2.5 rounded-2xl border border-line bg-sunken px-3.5 py-3 text-sm font-medium text-muted transition peer-checked:border-plum-line peer-checked:bg-plum-soft peer-checked:text-plum peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-plum"
                >
                  <BookmarkPlus size={16} />
                  Hold this date instead
                </label>

                <div className="hidden gap-1.5 peer-checked:grid">
                  <label className="field-label" htmlFor="holdExpiresAt">
                    Hold expires
                  </label>
                  <input id="holdExpiresAt" name="holdExpiresAt" type="date" className="input" />
                  <p className="text-xs leading-5 text-faint">
                    Blank keeps it 7 days. A hold never outlives the appointment date, and earns nothing until confirmed.
                  </p>
                </div>
              </div>

              <SubmitButton className="rounded-2xl bg-gradient-to-r from-plum to-wine px-4 py-3 text-sm font-semibold text-white" pendingText="Saving…">
                Add to calendar
              </SubmitButton>
            </div>
          </form>
        </section>
    </div>
  );
}
