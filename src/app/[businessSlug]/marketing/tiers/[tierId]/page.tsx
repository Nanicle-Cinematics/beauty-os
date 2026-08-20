import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { getTierDetail } from "@/lib/marketing-data";
import { updateTierAction, deleteTierAction } from "@/lib/marketing-actions";
import { requireTenantAccess } from "@/lib/auth";
import { membershipIn, roleCan } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ businessSlug: string; tierId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function TierDetailPage({ params, searchParams }: Props) {
  const { businessSlug, tierId } = await params;
  const { error } = await searchParams;
  const user = await requireTenantAccess(businessSlug, { module: "marketing" });

  const [tier, membership] = await Promise.all([
    getTierDetail(businessSlug, tierId),
    membershipIn(user, businessSlug),
  ]);
  if (!tier) notFound();

  const canEdit = roleCan(membership?.role, "marketing:edit");
  const canDelete = roleCan(membership?.role, "marketing:delete");
  const symbol = tier.currency === "GHS" ? "GH₵" : tier.currency;

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-5">
      <PageHeader title={tier.name} description="Loyalty tier details.">
        <Link href={`/${businessSlug}/marketing`} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-4 py-2 text-sm font-medium text-muted hover:bg-sunken">
          <ArrowLeft size={15} /> Back
        </Link>
      </PageHeader>

      {error ? (
        <div className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">{error}</div>
      ) : null}

      {!canEdit ? (
        <div className="flex items-center gap-2.5 rounded-[18px] border border-white/60 bg-white/42 px-4 py-3 text-[13px] font-medium text-muted">
          <ShieldAlert size={15} className="shrink-0 text-faint" /> Your role can view this tier but not change it.
        </div>
      ) : null}

      <form action={updateTierAction} className="card grid gap-4 p-5">
        <input type="hidden" name="businessSlug" value={businessSlug} />
        <input type="hidden" name="tierId" value={tier.id} />
        <fieldset disabled={!canEdit} className="grid gap-4 disabled:opacity-60">
          <label className="field-label">
            Name
            <input name="name" defaultValue={tier.name} className="input" required />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="field-label">
              Min points
              <input name="minPoints" type="number" min="0" step="1" defaultValue={tier.minPoints} className="input" placeholder="None" />
            </label>
            <label className="field-label">
              Min spend ({symbol})
              <input name="minSpend" type="number" min="0" step="0.01" defaultValue={tier.minSpend} className="input" placeholder="None" />
            </label>
            <label className="field-label">
              Discount (%)
              <input name="discountPercent" type="number" min="0" max="100" step="0.5" defaultValue={tier.discountPercent} className="input" placeholder="None" />
            </label>
          </div>
          <label className="field-label">
            Perks
            <textarea name="perks" defaultValue={tier.perks} rows={3} className="input" placeholder="What members of this tier get." />
          </label>
          {canEdit ? (
            <div className="flex flex-wrap gap-2.5 border-t border-line-2 pt-4">
              <SubmitButton className="rounded-2xl primary-action px-5 py-3 text-sm font-semibold text-white" pendingText="Saving…">Save changes</SubmitButton>
              <Link href={`/${businessSlug}/marketing`} className="rounded-2xl border border-line px-5 py-3 text-sm font-semibold text-muted hover:bg-sunken">Cancel</Link>
            </div>
          ) : null}
        </fieldset>
      </form>

      {canDelete ? (
        <section className="card border-danger/15 p-5">
          <h2 className="text-[15px] font-semibold">Danger zone</h2>
          <p className="mt-0.5 text-[12.5px] leading-5 text-muted">Delete this loyalty tier.</p>
          <form action={deleteTierAction} className="mt-4">
            <input type="hidden" name="businessSlug" value={businessSlug} />
            <input type="hidden" name="tierId" value={tier.id} />
            <SubmitButton className="inline-flex items-center gap-1.5 rounded-xl border border-danger/25 bg-danger-soft px-4 py-2.5 text-[13px] font-semibold text-danger hover:bg-danger hover:text-white" pendingText="Deleting…">
              <Trash2 size={14} /> Delete tier
            </SubmitButton>
          </form>
        </section>
      ) : null}
    </div>
  );
}
