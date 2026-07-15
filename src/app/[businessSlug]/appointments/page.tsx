import { CalendarPlus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge, toneForStatus, EmptyState, Avatar } from "@/components/ui";
import { notFound } from "next/navigation";
import { createAppointmentAction, updateAppointmentStatusAction } from "@/lib/appointment-actions";
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
              <p className="mt-1 text-sm text-[#796e77]">
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
                    <Badge tone={toneForStatus(appointment.status)}>{appointment.status}</Badge>
                    <span className="font-semibold text-ink">{appointment.value}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {statusOptions.map((option) => (
                        <form key={option.value} action={updateAppointmentStatusAction}>
                          <input type="hidden" name="businessSlug" value={businessSlug} />
                          <input type="hidden" name="appointmentId" value={appointment.id} />
                          <input type="hidden" name="status" value={option.value} />
                          <button className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-muted hover:border-plum-line hover:bg-plum-soft hover:text-plum">
                            {option.label}
                          </button>
                        </form>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form action={createAppointmentAction} className="card p-5">
            <h2 className="text-lg font-semibold">Create booking</h2>
            <p className="mt-1 text-sm leading-6 text-[#796e77]">
              Creates a confirmed appointment scoped to {data.tenant.name}.
            </p>

            <input type="hidden" name="businessSlug" value={businessSlug} />

            <div className="mt-5 grid gap-4">
              <label className="field-label">
                Client
                <select name="customerId" className="input" required>
                  {data.customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>{customer.label}</option>
                  ))}
                </select>
              </label>

              <label className="field-label">
                Service
                <select name="serviceId" className="input" required>
                  {data.services.map((service) => (
                    <option key={service.id} value={service.id}>{service.label}</option>
                  ))}
                </select>
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

              <button className="rounded-2xl bg-gradient-to-r from-plum to-wine px-4 py-3 text-sm font-semibold text-white">
                Create appointment
              </button>
            </div>
          </form>
        </section>
    </div>
  );
}
