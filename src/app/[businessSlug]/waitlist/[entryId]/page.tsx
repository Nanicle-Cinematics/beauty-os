import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Trash2, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { Combobox } from "@/components/combobox";
import { getWaitlistDetail, getWaitlistModuleData } from "@/lib/waitlist-data";
import {
  updateWaitlistEntryAction,
  promoteWaitlistEntryAction,
  deleteWaitlistEntryAction,
} from "@/lib/waitlist-actions";
import { requireTenantAccess } from "@/lib/auth";
import { membershipIn, roleCan } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const STATUSES = [
  { value: "WAITING", label: "Waiting" },
  { value: "NOTIFIED", label: "Notified" },
  { value: "BOOKED", label: "Booked" },
  { value: "EXPIRED", label: "Expired" },
];

type Props = {
  params: Promise<{ businessSlug: string; entryId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function WaitlistDetailPage({ params, searchParams }: Props) {
  const { businessSlug, entryId } = await params;
  const { error } = await searchParams;
  const user = await requireTenantAccess(businessSlug);

  const [entry, module, membership] = await Promise.all([
    getWaitlistDetail(businessSlug, entryId),
    getWaitlistModuleData(businessSlug),
    membershipIn(user, businessSlug),
  ]);
  if (!entry || !module) notFound();

  const canManage = roleCan(membership?.role, "appointments:edit");

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-5">
      <PageHeader title={entry.customerName} description="Waitlist entry.">
        <Link href={`/${businessSlug}/waitlist`} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-4 py-2 text-sm font-medium text-muted hover:bg-sunken">
          <ArrowLeft size={15} /> Back
        </Link>
      </PageHeader>

      {error ? (
        <div className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">{error}</div>
      ) : null}

      {!canManage ? (
        <div className="flex items-center gap-2.5 rounded-[18px] border border-white/60 bg-white/42 px-4 py-3 text-[13px] font-medium text-muted">
          <ShieldAlert size={15} className="shrink-0 text-faint" /> Your role can view the waitlist but not change it.
        </div>
      ) : null}

      {canManage && entry.status !== "BOOKED" ? (
        <form action={promoteWaitlistEntryAction} className="card flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <h2 className="text-[15px] font-semibold">A slot opened up?</h2>
            <p className="mt-0.5 text-[12.5px] text-muted">Promote this client to a provisional hold, then set the exact time.</p>
          </div>
          <input type="hidden" name="businessSlug" value={businessSlug} />
          <input type="hidden" name="entryId" value={entry.id} />
          <SubmitButton className="inline-flex items-center gap-1.5 rounded-2xl primary-action px-5 py-3 text-sm font-semibold text-white" pendingText="Holding…">
            Promote to hold <ArrowUpRight size={15} />
          </SubmitButton>
        </form>
      ) : null}

      <form action={updateWaitlistEntryAction} className="card grid gap-4 p-5">
        <input type="hidden" name="businessSlug" value={businessSlug} />
        <input type="hidden" name="entryId" value={entry.id} />
        <fieldset disabled={!canManage} className="grid gap-4 disabled:opacity-60">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field-label">
              Client
              <Combobox name="customer" options={module.customers.map((c) => c.label)} defaultValue={entry.customerName} required placeholder="Search or type a client…" />
            </label>
            <label className="field-label">
              Service
              <Combobox name="service" options={module.services.map((s) => s.label)} defaultValue={entry.serviceName} required placeholder="Search or type a service…" />
            </label>
            <label className="field-label">
              Preferred staff
              <select name="preferredStaffId" defaultValue={entry.preferredStaffId} className="input">
                <option value="">Any staff</option>
                {module.staff.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
            <label className="field-label">
              Status
              <select name="status" defaultValue={entry.status} className="input">
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
            <label className="field-label">
              Earliest date
              <input name="earliestDate" type="date" defaultValue={entry.earliestDate} className="input" />
            </label>
            <label className="field-label">
              Latest date
              <input name="latestDate" type="date" defaultValue={entry.latestDate} className="input" />
            </label>
          </div>
          {canManage ? (
            <div className="flex flex-wrap gap-2.5 border-t border-line-2 pt-4">
              <SubmitButton className="rounded-2xl primary-action px-5 py-3 text-sm font-semibold text-white" pendingText="Saving…">Save changes</SubmitButton>
              <Link href={`/${businessSlug}/waitlist`} className="rounded-2xl border border-line px-5 py-3 text-sm font-semibold text-muted hover:bg-sunken">Cancel</Link>
            </div>
          ) : null}
        </fieldset>
      </form>

      {canManage ? (
        <section className="card border-danger/15 p-5">
          <h2 className="text-[15px] font-semibold">Danger zone</h2>
          <p className="mt-0.5 text-[12.5px] leading-5 text-muted">Remove this client from the waitlist entirely.</p>
          <form action={deleteWaitlistEntryAction} className="mt-4">
            <input type="hidden" name="businessSlug" value={businessSlug} />
            <input type="hidden" name="entryId" value={entry.id} />
            <SubmitButton className="inline-flex items-center gap-1.5 rounded-xl border border-danger/25 bg-danger-soft px-4 py-2.5 text-[13px] font-semibold text-danger hover:bg-danger hover:text-white" pendingText="Removing…">
              <Trash2 size={14} /> Remove from waitlist
            </SubmitButton>
          </form>
        </section>
      ) : null}
    </div>
  );
}
