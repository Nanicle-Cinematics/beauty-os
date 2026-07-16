import { PageHeader } from "@/components/page-header";
import { StatTile, statMetaFor, Badge, toneForStatus, Avatar } from "@/components/ui";
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
          {data.stats.map((stat) => {
            const meta = statMetaFor(stat.label);
            return (
              <StatTile key={stat.label} label={stat.label} value={stat.value} detail={stat.detail} icon={meta.icon} tone={meta.tone} />
            );
          })}
        </section>

        <section className="grid grid-cols-[minmax(0,1fr)_380px] gap-5 max-[1080px]:grid-cols-1">
          <div className="card p-5">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Team roster</h2>
              <p className="mt-1 text-sm text-muted">
                Roles, commission, workload, and revenue for this business.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-line">
              <div className="grid grid-cols-[1.5fr_1fr_110px_80px_120px_150px] bg-plum-soft px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted max-[980px]:hidden">
                <span>Member</span><span>Role</span><span>Commission</span><span>Books</span><span>Revenue</span><span>Status</span>
              </div>
              {data.staff.map((member) => (
                <div key={member.id} className="grid grid-cols-[1.5fr_1fr_110px_80px_120px_150px] items-center gap-3 border-t border-line-2 px-4 py-4 text-sm max-[980px]:grid-cols-1">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={member.name} colorHex={member.colorHex} />
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-ink">{member.name}</div>
                      <div className="truncate text-xs text-muted">{member.email}</div>
                    </div>
                  </div>
                  <div className="font-medium text-ink">{member.role}</div>
                  <div className="font-medium text-muted">{member.commission}</div>
                  <div className="font-semibold text-ink">{member.bookings}</div>
                  <div className="font-semibold text-ink">{member.revenue}</div>
                  <div className="flex flex-col items-start gap-2">
                    <Badge tone={toneForStatus(member.status)}>{member.status}</Badge>
                    <div className="flex flex-wrap gap-1">
                      {(member.isSoleOwner ? [] : statusActions(member.statusKey)).map((action) => (
                        <form key={action.value} action={setStaffStatusAction}>
                          <input type="hidden" name="businessSlug" value={businessSlug} />
                          <input type="hidden" name="staffId" value={member.id} />
                          <input type="hidden" name="status" value={action.value} />
                          <button className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                            action.tone === "danger"
                              ? "border-danger/25 text-danger hover:bg-danger-soft"
                              : "border-line text-muted hover:border-plum-line hover:bg-plum-soft hover:text-plum"
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

          <form action={inviteStaffAction} className="card p-5">
            <h2 className="text-lg font-semibold">Invite staff</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Invites join {data.tenant.name} as pending until activated.
            </p>

            <input type="hidden" name="businessSlug" value={businessSlug} />

            <div className="mt-5 grid gap-4">
              <label className="field-label">
                Email
                <input name="email" type="email" className="input" required />
              </label>

              <label className="field-label">
                Role
                <select name="role" defaultValue="ARTIST" className="input" required>
                  {data.roles.map((role) => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
                <label className="field-label">
                  Commission
                  <select name="commissionType" defaultValue="NONE" className="input">
                    <option value="NONE">None</option>
                    <option value="PERCENTAGE">Percentage</option>
                    <option value="FIXED">Fixed</option>
                  </select>
                </label>
                <label className="field-label">
                  Value
                  <input name="commissionValue" type="number" min="0" step="0.01" placeholder="e.g. 15" className="input" />
                </label>
              </div>

              <label className="field-label">
                Colour
                <input name="colorHex" type="color" defaultValue="#6d315f" className="input" />
              </label>

              <label className="field-label">
                Bio
                <textarea name="bio" rows={2} className="input" />
              </label>

              <button className="rounded-2xl bg-gradient-to-r from-plum to-wine px-4 py-3 text-sm font-semibold text-white">
                Send invite
              </button>
            </div>
          </form>
        </section>
    </div>
  );
}
