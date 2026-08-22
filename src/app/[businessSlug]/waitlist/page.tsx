import Link from "next/link";
import { notFound } from "next/navigation";
import { Hourglass, ArrowUpRight, ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Combobox } from "@/components/combobox";
import { SubmitButton } from "@/components/submit-button";
import { Badge, toneForStatus, EmptyState } from "@/components/ui";
import { getWaitlistModuleData } from "@/lib/waitlist-data";
import {
  createWaitlistEntryAction,
  promoteWaitlistEntryAction,
  deleteWaitlistEntryAction,
} from "@/lib/waitlist-actions";
import { requireTenantAccess } from "@/lib/auth";
import { membershipIn, roleCan } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ businessSlug: string }> };

export default async function WaitlistPage({ params }: Props) {
  const { businessSlug } = await params;
  const user = await requireTenantAccess(businessSlug, { module: "waitlist" });
  const [data, membership] = await Promise.all([
    getWaitlistModuleData(businessSlug),
    membershipIn(user, businessSlug),
  ]);
  if (!data) notFound();

  const canManage = roleCan(membership?.role, "appointments:edit");

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Waitlist"
        description="Clients waiting for a slot — promote them to a hold when one opens up."
      />

      <section className="grid gap-5">
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Waiting</h2>
              <p className="mt-1 text-sm text-muted">
                {data.waitingCount} {data.waitingCount === 1 ? "client" : "clients"} currently waiting.
              </p>
            </div>
          </div>

          {data.entries.length === 0 ? (
            <EmptyState icon={Hourglass} title="No one waiting" body="Add a client using Add to waitlist below when a service is fully booked." />
          ) : (
            <div className="glass-panel overflow-hidden rounded-[26px]">
              <div className="grid grid-cols-[1.3fr_1fr_1fr_110px_150px] gap-3 bg-plum-soft px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted max-[940px]:hidden">
                <span>Client</span><span>Service</span><span>Window</span><span>Status</span><span>Actions</span>
              </div>
              {data.entries.map((entry) => (
                <div key={entry.id} className="grid grid-cols-[1.3fr_1fr_1fr_110px_150px] items-center gap-3 border-t border-line-2 px-4 py-3.5 text-sm max-[940px]:grid-cols-1">
                  <div className="min-w-0">
                    <Link href={`/${businessSlug}/waitlist/${entry.id}`} className="truncate font-semibold text-ink hover:text-plum hover:underline">
                      {entry.client}
                    </Link>
                    <div className="mt-0.5 truncate text-xs text-muted">{entry.staff}</div>
                  </div>
                  <span className="truncate font-medium text-ink">{entry.service}</span>
                  <span className="truncate text-xs font-semibold text-muted">{entry.window}</span>
                  <Badge tone={toneForStatus(entry.status)}>{entry.status}</Badge>
                  <div className="flex flex-wrap gap-1.5">
                    {canManage && entry.statusKey !== "BOOKED" ? (
                      <form action={promoteWaitlistEntryAction}>
                        <input type="hidden" name="businessSlug" value={businessSlug} />
                        <input type="hidden" name="entryId" value={entry.id} />
                        <button className="inline-flex items-center gap-1 rounded-lg border border-plum-line bg-plum-soft px-2.5 py-1.5 text-xs font-semibold text-plum hover:bg-plum hover:text-white">
                          Promote <ArrowUpRight size={12} />
                        </button>
                      </form>
                    ) : null}
                    {canManage ? (
                      <form action={deleteWaitlistEntryAction}>
                        <input type="hidden" name="businessSlug" value={businessSlug} />
                        <input type="hidden" name="entryId" value={entry.id} />
                        <button className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-muted hover:border-danger/30 hover:bg-danger-soft hover:text-danger">
                          Remove
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <details id="add-waitlist" className="group card overflow-hidden p-0">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden">
            <div>
              <h2 className="text-lg font-semibold">Add to waitlist</h2>
              <p className="mt-1 text-sm leading-6 text-muted">For a client wanting a slot that isn&apos;t free yet.</p>
            </div>
            <ChevronDown size={18} className="shrink-0 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <form action={createWaitlistEntryAction} className="border-t border-line-2 p-5">
            <input type="hidden" name="businessSlug" value={businessSlug} />
            <fieldset disabled={!canManage} className="grid gap-4 disabled:opacity-60">
            <label className="field-label">
              Client
              <Combobox name="customer" options={data.customers.map((c) => c.label)} required placeholder="Search or type a client…" />
            </label>
            <label className="field-label">
              Service
              <Combobox name="service" options={data.services.map((s) => s.label)} required placeholder="Search or type a service…" />
            </label>
            <label className="field-label">
              Preferred staff (optional)
              <select name="preferredStaffId" className="input">
                <option value="">Any staff</option>
                {data.staff.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
              <label className="field-label">
                Earliest date
                <input name="earliestDate" type="date" className="input" />
              </label>
              <label className="field-label">
                Latest date
                <input name="latestDate" type="date" className="input" />
              </label>
            </div>
            <SubmitButton className="rounded-2xl primary-action px-4 py-3 text-sm font-semibold text-white" pendingText="Adding…">
              Add to waitlist
            </SubmitButton>
          </fieldset>
          </form>
        </details>
      </section>
    </div>
  );
}
