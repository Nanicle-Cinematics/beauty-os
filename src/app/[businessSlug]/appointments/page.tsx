import { PageHeader } from "@/components/page-header";
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

            <div className="overflow-hidden rounded-2xl border border-[#e9dee5]">
              <div className="grid grid-cols-[82px_1fr_1fr_130px_110px_220px] bg-[#f5eff2] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#796e77] max-[940px]:hidden">
                <span>Time</span><span>Client</span><span>Service</span><span>Status</span><span>Value</span><span>Actions</span>
              </div>
              {data.appointments.map((appointment) => (
                <div key={appointment.id} className="grid grid-cols-[82px_1fr_1fr_130px_110px_220px] items-center gap-3 border-t border-[#f0e8ed] px-4 py-4 text-sm max-[940px]:grid-cols-1">
                  <span className="font-semibold text-[#6d315f]">{appointment.time}</span>
                  <div>
                    <div className="font-semibold">{appointment.client}</div>
                    <div className="mt-1 text-xs font-semibold text-[#796e77]">{appointment.staff}</div>
                  </div>
                  <span className="font-bold">{appointment.service}</span>
                  <span className="w-fit rounded-full bg-[#f6edf2] px-3 py-1 text-xs font-semibold text-[#6d315f]">
                    {appointment.status}
                  </span>
                  <span className="font-semibold">{appointment.value}</span>
                  <div className="flex flex-wrap gap-2">
                    {statusOptions.map((option) => (
                      <form key={option.value} action={updateAppointmentStatusAction}>
                        <input type="hidden" name="businessSlug" value={businessSlug} />
                        <input type="hidden" name="appointmentId" value={appointment.id} />
                        <input type="hidden" name="status" value={option.value} />
                        <button className="rounded-xl border border-[#e9dee5] px-3 py-2 text-xs font-semibold">
                          {option.label}
                        </button>
                      </form>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form action={createAppointmentAction} className="card p-5">
            <h2 className="text-lg font-semibold">Create booking</h2>
            <p className="mt-1 text-sm leading-6 text-[#796e77]">
              Creates a confirmed appointment scoped to {data.tenant.name}.
            </p>

            <input type="hidden" name="businessSlug" value={businessSlug} />

            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-bold">
                Client
                <select name="customerId" className="h-12 rounded-2xl border border-[#e9dee5] bg-[#f7f2f5] px-4 outline-none" required>
                  {data.customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>{customer.label}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-bold">
                Service
                <select name="serviceId" className="h-12 rounded-2xl border border-[#e9dee5] bg-[#f7f2f5] px-4 outline-none" required>
                  {data.services.map((service) => (
                    <option key={service.id} value={service.id}>{service.label}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-bold">
                Staff
                <select name="staffMemberId" className="h-12 rounded-2xl border border-[#e9dee5] bg-[#f7f2f5] px-4 outline-none" required>
                  {data.staff.map((person) => (
                    <option key={person.id} value={person.id}>{person.label}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-bold">
                Start time
                <input
                  name="startAt"
                  type="datetime-local"
                  defaultValue="2026-07-13T14:00"
                  className="h-12 rounded-2xl border border-[#e9dee5] bg-[#f7f2f5] px-4 outline-none"
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
