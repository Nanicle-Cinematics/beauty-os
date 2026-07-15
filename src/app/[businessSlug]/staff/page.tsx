import { PageHeader } from "@/components/page-header";
import { notFound } from "next/navigation";
import { inviteStaffAction, setStaffStatusAction } from "@/lib/staff-actions";
import { getStaffModuleData } from "@/lib/staff-data";
import { requireTenantAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

type StaffPageProps = {
  params: Promise<{
    businessSlug: string;
  }>;
};

const statusStyles: Record<string, string> = {
  ACTIVE: "bg-[#f6edf2] text-[#6d315f]",
  INVITED: "bg-amber-50 text-amber-700",
  SUSPENDED: "bg-rose-50 text-rose-700",
  REMOVED: "bg-[#f0eaee] text-[#796e77]",
};

function statusActions(statusKey: string): { label: string; value: string; tone?: "danger" }[] {
  if (statusKey === "ACTIVE") {
    return [{ label: "Suspend", value: "SUSPENDED", tone: "danger" }];
  }
  if (statusKey === "INVITED") {
    return [
      { label: "Activate", value: "ACTIVE" },
      { label: "Remove", value: "REMOVED", tone: "danger" },
    ];
  }
  if (statusKey === "SUSPENDED") {
    return [
      { label: "Reactivate", value: "ACTIVE" },
      { label: "Remove", value: "REMOVED", tone: "danger" },
    ];
  }
  return [];
}

export default async function StaffPage({ params }: StaffPageProps) {
  const { businessSlug } = await params;
  await requireTenantAccess(businessSlug);
  const data = await getStaffModuleData(businessSlug);

  if (!data) {
    notFound();
  }

  return (
    <div className="grid gap-5">
      <PageHeader title="Staff" description="Your team — roles, access, and who is on the floor." />

        <section className="grid grid-cols-4 gap-4 max-[1080px]:grid-cols-2 max-[640px]:grid-cols-1">
          {data.stats.map((stat) => (
            <article key={stat.label} className="rounded-3xl border border-[#e9dee5] bg-white p-5 shadow-[0_12px_35px_rgba(84,33,63,0.05)]">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#796e77]">
                {stat.label}
              </div>
              <div className="mt-4 text-3xl font-bold tracking-tight">{stat.value}</div>
              <div className="mt-2 text-sm font-semibold text-[#796e77]">{stat.detail}</div>
            </article>
          ))}
        </section>

        <section className="grid grid-cols-[minmax(0,1fr)_380px] gap-5 max-[1080px]:grid-cols-1">
          <div className="rounded-[24px] border border-[#e9dee5] bg-white p-5 shadow-[0_12px_35px_rgba(84,33,63,0.06)]">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Team roster</h2>
              <p className="mt-1 text-sm text-[#796e77]">
                Roles, commission, workload, and revenue for this business.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#e9dee5]">
              <div className="grid grid-cols-[1.5fr_1fr_110px_80px_120px_150px] bg-[#f5eff2] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#796e77] max-[980px]:hidden">
                <span>Member</span><span>Role</span><span>Commission</span><span>Books</span><span>Revenue</span><span>Status</span>
              </div>
              {data.staff.map((member) => (
                <div key={member.id} className="grid grid-cols-[1.5fr_1fr_110px_80px_120px_150px] items-center gap-3 border-t border-[#f0e8ed] px-4 py-4 text-sm max-[980px]:grid-cols-1">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white" style={{ backgroundColor: member.colorHex }}>
                      {member.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{member.name}</div>
                      <div className="truncate text-xs font-semibold text-[#796e77]">{member.email}</div>
                    </div>
                  </div>
                  <div className="font-bold">{member.role}</div>
                  <div className="font-bold text-[#796e77]">{member.commission}</div>
                  <div className="font-semibold">{member.bookings}</div>
                  <div className="font-semibold">{member.revenue}</div>
                  <div className="flex flex-col items-start gap-2">
                    <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[member.statusKey]}`}>
                      {member.status}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {(member.isSoleOwner ? [] : statusActions(member.statusKey)).map((action) => (
                        <form key={action.value} action={setStaffStatusAction}>
                          <input type="hidden" name="businessSlug" value={businessSlug} />
                          <input type="hidden" name="staffId" value={member.id} />
                          <input type="hidden" name="status" value={action.value} />
                          <button className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                            action.tone === "danger"
                              ? "border-rose-200 text-rose-700"
                              : "border-[#e9dee5] text-[#231c22]"
                          }`}>
                            {action.label}
                          </button>
                        </form>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form action={inviteStaffAction} className="rounded-[24px] border border-[#e9dee5] bg-white p-5 shadow-[0_12px_35px_rgba(84,33,63,0.06)]">
            <h2 className="text-lg font-semibold">Invite staff</h2>
            <p className="mt-1 text-sm leading-6 text-[#796e77]">
              Invites join {data.tenant.name} as pending until activated.
            </p>

            <input type="hidden" name="businessSlug" value={businessSlug} />

            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-bold">
                Email
                <input name="email" type="email" className="h-12 rounded-2xl border border-[#e9dee5] bg-[#f7f2f5] px-4 outline-none focus:border-[#6d315f]" required />
              </label>

              <label className="grid gap-2 text-sm font-bold">
                Role
                <select name="role" defaultValue="ARTIST" className="h-12 rounded-2xl border border-[#e9dee5] bg-[#f7f2f5] px-4 outline-none focus:border-[#6d315f]" required>
                  {data.roles.map((role) => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-2 text-sm font-bold">
                  Commission
                  <select name="commissionType" defaultValue="NONE" className="h-12 rounded-2xl border border-[#e9dee5] bg-[#f7f2f5] px-4 outline-none focus:border-[#6d315f]">
                    <option value="NONE">None</option>
                    <option value="PERCENTAGE">Percentage</option>
                    <option value="FIXED">Fixed</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  Value
                  <input name="commissionValue" type="number" min="0" step="0.01" placeholder="e.g. 15" className="h-12 rounded-2xl border border-[#e9dee5] bg-[#f7f2f5] px-4 outline-none focus:border-[#6d315f]" />
                </label>
              </div>

              <label className="grid gap-2 text-sm font-bold">
                Colour
                <input name="colorHex" type="color" defaultValue="#6d315f" className="h-12 w-full rounded-2xl border border-[#e9dee5] bg-[#f7f2f5] px-2 outline-none" />
              </label>

              <label className="grid gap-2 text-sm font-bold">
                Bio
                <textarea name="bio" rows={2} className="rounded-2xl border border-[#e9dee5] bg-[#f7f2f5] px-4 py-3 outline-none focus:border-[#6d315f]" />
              </label>

              <button className="rounded-2xl bg-[#54213f] px-4 py-3 text-sm font-semibold text-white">
                Send invite
              </button>
            </div>
          </form>
        </section>
    </div>
  );
}
