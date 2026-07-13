import Link from "next/link";
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
    <main className="min-h-screen bg-[#f6f8f6] px-6 py-6 text-[#111b17] max-[720px]:px-3">
      <div className="mx-auto grid max-w-7xl gap-5">
        <header className="flex items-center justify-between gap-4 rounded-3xl border border-[#dbe4de] bg-white px-5 py-4 shadow-[0_18px_45px_rgba(16,38,31,0.08)] max-[720px]:flex-col max-[720px]:items-start">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#1d7b5d]">
              {data.tenant.name}
            </div>
            <h1 className="text-2xl font-black tracking-tight">Appointments</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/${businessSlug}`} className="rounded-2xl border border-[#dbe4de] px-4 py-2 text-sm font-black">
              Dashboard
            </Link>
            <Link href="/logout" className="rounded-2xl border border-[#dbe4de] px-4 py-2 text-sm font-black">
              Sign out
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-[minmax(0,1fr)_360px] gap-5 max-[1080px]:grid-cols-1">
          <div className="rounded-[24px] border border-[#dbe4de] bg-white p-5 shadow-[0_12px_35px_rgba(16,38,31,0.06)]">
            <div className="mb-4">
              <h2 className="text-lg font-black">Schedule</h2>
              <p className="mt-1 text-sm text-[#6b7c73]">
                Tenant-scoped appointment records for this business only.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#dbe4de]">
              <div className="grid grid-cols-[82px_1fr_1fr_130px_110px_220px] bg-[#f2f7f4] px-4 py-3 text-[11px] font-black uppercase tracking-[0.12em] text-[#65766d] max-[940px]:hidden">
                <span>Time</span><span>Client</span><span>Service</span><span>Status</span><span>Value</span><span>Actions</span>
              </div>
              {data.appointments.map((appointment) => (
                <div key={appointment.id} className="grid grid-cols-[82px_1fr_1fr_130px_110px_220px] items-center gap-3 border-t border-[#e6eee9] px-4 py-4 text-sm max-[940px]:grid-cols-1">
                  <span className="font-black text-[#1d7b5d]">{appointment.time}</span>
                  <div>
                    <div className="font-black">{appointment.client}</div>
                    <div className="mt-1 text-xs font-semibold text-[#6b7c73]">{appointment.staff}</div>
                  </div>
                  <span className="font-bold">{appointment.service}</span>
                  <span className="w-fit rounded-full bg-[#eff7f2] px-3 py-1 text-xs font-black text-[#1d7b5d]">
                    {appointment.status}
                  </span>
                  <span className="font-black">{appointment.value}</span>
                  <div className="flex flex-wrap gap-2">
                    {statusOptions.map((option) => (
                      <form key={option.value} action={updateAppointmentStatusAction}>
                        <input type="hidden" name="businessSlug" value={businessSlug} />
                        <input type="hidden" name="appointmentId" value={appointment.id} />
                        <input type="hidden" name="status" value={option.value} />
                        <button className="rounded-xl border border-[#dbe4de] px-3 py-2 text-xs font-black">
                          {option.label}
                        </button>
                      </form>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form action={createAppointmentAction} className="rounded-[24px] border border-[#dbe4de] bg-white p-5 shadow-[0_12px_35px_rgba(16,38,31,0.06)]">
            <h2 className="text-lg font-black">Create booking</h2>
            <p className="mt-1 text-sm leading-6 text-[#6b7c73]">
              Creates a confirmed appointment scoped to {data.tenant.name}.
            </p>

            <input type="hidden" name="businessSlug" value={businessSlug} />

            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-bold">
                Client
                <select name="customerId" className="h-12 rounded-2xl border border-[#dbe4de] bg-[#f8faf8] px-4 outline-none" required>
                  {data.customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>{customer.label}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-bold">
                Service
                <select name="serviceId" className="h-12 rounded-2xl border border-[#dbe4de] bg-[#f8faf8] px-4 outline-none" required>
                  {data.services.map((service) => (
                    <option key={service.id} value={service.id}>{service.label}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-bold">
                Staff
                <select name="staffMemberId" className="h-12 rounded-2xl border border-[#dbe4de] bg-[#f8faf8] px-4 outline-none" required>
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
                  className="h-12 rounded-2xl border border-[#dbe4de] bg-[#f8faf8] px-4 outline-none"
                  required
                />
              </label>

              <button className="rounded-2xl bg-[#10261f] px-4 py-3 text-sm font-black text-white">
                Create appointment
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
