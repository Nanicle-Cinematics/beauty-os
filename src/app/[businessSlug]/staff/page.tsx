import Link from "next/link";
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
  ACTIVE: "bg-[#faf1f6] text-[#9d4e7a]",
  INVITED: "bg-amber-50 text-amber-700",
  SUSPENDED: "bg-rose-50 text-rose-700",
  REMOVED: "bg-[#f2f2f4] text-[#71717a]",
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
    <main className="min-h-screen bg-[#fafafa] px-6 py-6 text-[#18181b] max-[720px]:px-3">
      <div className="mx-auto grid max-w-7xl gap-5">
        <header className="flex items-center justify-between gap-4 rounded-3xl border border-[#e7e7ea] bg-white px-5 py-4 shadow-[0_18px_45px_rgba(24,24,27,0.08)] max-[720px]:flex-col max-[720px]:items-start">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9d4e7a]">
              {data.tenant.name}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Staff</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/${businessSlug}`} className="rounded-2xl border border-[#e7e7ea] px-4 py-2 text-sm font-semibold">
              Dashboard
            </Link>
            <Link href={`/${businessSlug}/services`} className="rounded-2xl border border-[#e7e7ea] px-4 py-2 text-sm font-semibold">
              Services
            </Link>
            <Link href="/logout" className="rounded-2xl border border-[#e7e7ea] px-4 py-2 text-sm font-semibold">
              Sign out
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-4 gap-4 max-[1080px]:grid-cols-2 max-[640px]:grid-cols-1">
          {data.stats.map((stat) => (
            <article key={stat.label} className="rounded-3xl border border-[#e7e7ea] bg-white p-5 shadow-[0_12px_35px_rgba(24,24,27,0.05)]">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#71717a]">
                {stat.label}
              </div>
              <div className="mt-4 text-3xl font-semibold tracking-tight">{stat.value}</div>
              <div className="mt-2 text-sm font-semibold text-[#71717a]">{stat.detail}</div>
            </article>
          ))}
        </section>

        <section className="grid grid-cols-[minmax(0,1fr)_380px] gap-5 max-[1080px]:grid-cols-1">
          <div className="rounded-[24px] border border-[#e7e7ea] bg-white p-5 shadow-[0_12px_35px_rgba(24,24,27,0.06)]">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Team roster</h2>
              <p className="mt-1 text-sm text-[#71717a]">
                Roles, commission, workload, and revenue for this business.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#e7e7ea]">
              <div className="grid grid-cols-[1.5fr_1fr_110px_80px_120px_150px] bg-[#f4f4f6] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#71717a] max-[980px]:hidden">
                <span>Member</span><span>Role</span><span>Commission</span><span>Books</span><span>Revenue</span><span>Status</span>
              </div>
              {data.staff.map((member) => (
                <div key={member.id} className="grid grid-cols-[1.5fr_1fr_110px_80px_120px_150px] items-center gap-3 border-t border-[#efeff2] px-4 py-4 text-sm max-[980px]:grid-cols-1">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white" style={{ backgroundColor: member.colorHex }}>
                      {member.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{member.name}</div>
                      <div className="truncate text-xs font-semibold text-[#71717a]">{member.email}</div>
                    </div>
                  </div>
                  <div className="font-bold">{member.role}</div>
                  <div className="font-bold text-[#71717a]">{member.commission}</div>
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
                              : "border-[#e7e7ea] text-[#18181b]"
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

          <form action={inviteStaffAction} className="rounded-[24px] border border-[#e7e7ea] bg-white p-5 shadow-[0_12px_35px_rgba(24,24,27,0.06)]">
            <h2 className="text-lg font-semibold">Invite staff</h2>
            <p className="mt-1 text-sm leading-6 text-[#71717a]">
              Invites join {data.tenant.name} as pending until activated.
            </p>

            <input type="hidden" name="businessSlug" value={businessSlug} />

            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-bold">
                Email
                <input name="email" type="email" className="h-12 rounded-2xl border border-[#e7e7ea] bg-[#f7f7f8] px-4 outline-none focus:border-[#9d4e7a]" required />
              </label>

              <label className="grid gap-2 text-sm font-bold">
                Role
                <select name="role" defaultValue="ARTIST" className="h-12 rounded-2xl border border-[#e7e7ea] bg-[#f7f7f8] px-4 outline-none focus:border-[#9d4e7a]" required>
                  {data.roles.map((role) => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-2 text-sm font-bold">
                  Commission
                  <select name="commissionType" defaultValue="NONE" className="h-12 rounded-2xl border border-[#e7e7ea] bg-[#f7f7f8] px-4 outline-none focus:border-[#9d4e7a]">
                    <option value="NONE">None</option>
                    <option value="PERCENTAGE">Percentage</option>
                    <option value="FIXED">Fixed</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  Value
                  <input name="commissionValue" type="number" min="0" step="0.01" placeholder="e.g. 15" className="h-12 rounded-2xl border border-[#e7e7ea] bg-[#f7f7f8] px-4 outline-none focus:border-[#9d4e7a]" />
                </label>
              </div>

              <label className="grid gap-2 text-sm font-bold">
                Colour
                <input name="colorHex" type="color" defaultValue="#9d4e7a" className="h-12 w-full rounded-2xl border border-[#e7e7ea] bg-[#f7f7f8] px-2 outline-none" />
              </label>

              <label className="grid gap-2 text-sm font-bold">
                Bio
                <textarea name="bio" rows={2} className="rounded-2xl border border-[#e7e7ea] bg-[#f7f7f8] px-4 py-3 outline-none focus:border-[#9d4e7a]" />
              </label>

              <button className="rounded-2xl bg-[#18181b] px-4 py-3 text-sm font-semibold text-white">
                Send invite
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
