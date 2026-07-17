import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { Avatar, Badge, toneForStatus } from "@/components/ui";
import { getStaffDetail, getServiceOptionsForStaff, BUSINESS_ROLES } from "@/lib/staff-data";
import { updateStaffProfileAction, setStaffRoleAction } from "@/lib/staff-actions";
import { requireTenantAccess } from "@/lib/auth";
import { membershipIn, roleCan } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type StaffDetailPageProps = {
  params: Promise<{ businessSlug: string; staffId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function StaffDetailPage({ params, searchParams }: StaffDetailPageProps) {
  const { businessSlug, staffId } = await params;
  const { error } = await searchParams;
  const user = await requireTenantAccess(businessSlug);

  const [member, services, membership] = await Promise.all([
    getStaffDetail(businessSlug, staffId, user.id),
    getServiceOptionsForStaff(businessSlug),
    membershipIn(user, businessSlug),
  ]);
  if (!member) notFound();

  const canEdit = roleCan(membership?.role, "staff:edit");
  const canRole = roleCan(membership?.role, "staff:role");
  const symbol = member.commissionType === "FIXED" ? "" : "%";
  // The role card is locked for the sole owner and for editing your own role —
  // both enforced server-side too; this just explains why the control is off.
  const roleLockReason = member.isSelf
    ? "You can't change your own role."
    : member.isSoleOwner
      ? "This is the workspace's only owner."
      : null;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5">
      <PageHeader title={member.name} description="View and manage this team member.">
        <Link
          href={`/${businessSlug}/staff`}
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

      <section className="card flex flex-wrap items-center gap-4 p-5">
        <Avatar name={member.name} colorHex={member.colorHex} size={52} />
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-semibold text-ink">{member.name}</div>
          <div className="truncate text-[13px] text-muted">{member.email || "No email on file"}</div>
        </div>
        <Badge tone={toneForStatus(member.status)}>{member.status}</Badge>
        {!member.linkedToUser ? <Badge tone="warning">Invite pending</Badge> : null}
      </section>

      {!canEdit ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-line bg-sunken px-4 py-3 text-[13px] font-medium text-muted">
          <ShieldAlert size={15} className="shrink-0 text-faint" />
          Your role can view this team member but not change their details.
        </div>
      ) : null}

      {/* Role — its own card, its own action, its own (stricter) permission. */}
      <section className="card p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-plum" />
          <h2 className="text-[15px] font-semibold">Role &amp; access</h2>
        </div>
        <p className="mt-0.5 text-[12.5px] leading-5 text-muted">
          A role decides what this person can do across the whole workspace. Only an owner can change it.
        </p>
        {roleLockReason ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-sunken px-3.5 py-2.5 text-[13px] font-medium text-muted">
            {roleLockReason} Current role: <span className="font-semibold text-ink">{titleCaseRole(member.role)}</span>
          </div>
        ) : (
          <form action={setStaffRoleAction} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="businessSlug" value={businessSlug} />
            <input type="hidden" name="staffId" value={member.id} />
            <label className="field-label">
              Role
              <select name="role" defaultValue={member.role} className="input" disabled={!canRole}>
                {BUSINESS_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            {canRole ? (
              <SubmitButton
                className="rounded-xl border border-line px-4 py-2.5 text-[13px] font-semibold text-ink hover:bg-sunken"
                pendingText="Saving…"
              >
                Update role
              </SubmitButton>
            ) : (
              <span className="pb-2.5 text-[12.5px] font-medium text-muted">Only an owner can change roles.</span>
            )}
          </form>
        )}
      </section>

      <form action={updateStaffProfileAction} className="card grid gap-5 p-5">
        <input type="hidden" name="businessSlug" value={businessSlug} />
        <input type="hidden" name="staffId" value={member.id} />
        <fieldset disabled={!canEdit} className="grid gap-5 disabled:opacity-60">
          <div>
            <h2 className="text-[15px] font-semibold">Profile</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="field-label sm:col-span-2">
                Bio
                <textarea name="bio" defaultValue={member.bio} rows={2} className="input" />
              </label>
              <label className="field-label">
                Calendar colour
                <input name="colorHex" defaultValue={member.colorHex} className="input" placeholder="#6d315f" />
              </label>
            </div>
          </div>

          <div className="border-t border-line-2 pt-5">
            <h2 className="text-[15px] font-semibold">Commission</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="field-label">
                Type
                <select name="commissionType" defaultValue={member.commissionType} className="input">
                  <option value="NONE">None</option>
                  <option value="PERCENTAGE">Percentage</option>
                  <option value="FIXED">Fixed amount</option>
                </select>
              </label>
              <label className="field-label">
                Value {symbol ? `(${symbol})` : ""}
                <input
                  name="commissionValue"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={member.commissionValue}
                  className="input"
                  placeholder="0"
                />
              </label>
            </div>
          </div>

          <div className="border-t border-line-2 pt-5">
            <h2 className="text-[15px] font-semibold">Services</h2>
            <p className="mt-0.5 text-[12.5px] text-muted">What this person is able to perform.</p>
            {services.length === 0 ? (
              <p className="mt-2 text-[12.5px] text-muted">No services yet.</p>
            ) : (
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {services.map((s) => (
                  <label
                    key={s.value}
                    className="flex items-center gap-2.5 rounded-xl border border-line-2 bg-sunken px-3.5 py-2.5 text-[13px] font-medium"
                  >
                    <input
                      type="checkbox"
                      name="serviceIds"
                      value={s.value}
                      defaultChecked={member.serviceIds.includes(s.value)}
                      className="size-4 accent-[var(--plum)]"
                    />
                    {s.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-line-2 pt-5">
            <h2 className="text-[15px] font-semibold">Working hours</h2>
            <div className="mt-3 grid gap-2">
              {member.hours.map((h) => (
                <div key={h.dayOfWeek} className="flex flex-wrap items-center gap-3 rounded-xl border border-line-2 bg-sunken px-3.5 py-2.5">
                  <span className="w-24 text-[13px] font-semibold text-ink">{WEEKDAY_LABELS[h.dayOfWeek]}</span>
                  <label className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted">
                    <input type="checkbox" name={`day-${h.dayOfWeek}-off`} defaultChecked={h.isOff} className="size-4 accent-[var(--plum)]" />
                    Day off
                  </label>
                  <div className="flex items-center gap-2">
                    <input type="time" name={`day-${h.dayOfWeek}-start`} defaultValue={h.startTime} className="input w-[120px]" />
                    <span className="text-muted">–</span>
                    <input type="time" name={`day-${h.dayOfWeek}-end`} defaultValue={h.endTime} className="input w-[120px]" />
                  </div>
                </div>
              ))}
            </div>
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
                href={`/${businessSlug}/staff`}
                className="rounded-2xl border border-line px-5 py-3 text-sm font-semibold text-muted hover:bg-sunken"
              >
                Cancel
              </Link>
            </div>
          ) : null}
        </fieldset>
      </form>
    </div>
  );
}

function titleCaseRole(role: string) {
  return BUSINESS_ROLES.find((r) => r.value === role)?.label ?? role;
}
