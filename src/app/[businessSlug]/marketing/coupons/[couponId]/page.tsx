import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { getCouponDetail } from "@/lib/marketing-data";
import { updateCouponAction, deleteCouponAction } from "@/lib/marketing-actions";
import { requireTenantAccess } from "@/lib/auth";
import { membershipIn, roleCan } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ businessSlug: string; couponId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function CouponDetailPage({ params, searchParams }: Props) {
  const { businessSlug, couponId } = await params;
  const { error } = await searchParams;
  const user = await requireTenantAccess(businessSlug);

  const [coupon, membership] = await Promise.all([
    getCouponDetail(businessSlug, couponId),
    membershipIn(user, businessSlug),
  ]);
  if (!coupon) notFound();

  const canEdit = roleCan(membership?.role, "marketing:edit");
  const canDelete = roleCan(membership?.role, "marketing:delete");
  const symbol = coupon.currency === "GHS" ? "GH₵" : coupon.currency;

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-5">
      <PageHeader title={coupon.code} description="Coupon details.">
        <Link href={`/${businessSlug}/marketing`} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-4 py-2 text-sm font-medium text-muted hover:bg-sunken">
          <ArrowLeft size={15} /> Back
        </Link>
      </PageHeader>

      {error ? (
        <div className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">{error}</div>
      ) : null}

      {!canEdit ? (
        <div className="flex items-center gap-2.5 rounded-[18px] border border-white/60 bg-white/42 px-4 py-3 text-[13px] font-medium text-muted">
          <ShieldAlert size={15} className="shrink-0 text-faint" /> Your role can view this coupon but not change it.
        </div>
      ) : null}

      <form action={updateCouponAction} className="card grid gap-4 p-5">
        <input type="hidden" name="businessSlug" value={businessSlug} />
        <input type="hidden" name="couponId" value={coupon.id} />
        <fieldset disabled={!canEdit} className="grid gap-4 disabled:opacity-60">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field-label">
              Code
              <input name="code" defaultValue={coupon.code} className="input font-mono uppercase" required />
            </label>
            <label className="field-label">
              Used
              <input value={`${coupon.usedCount} time${coupon.usedCount === 1 ? "" : "s"}`} className="input" disabled />
            </label>
            <label className="field-label">
              Discount type
              <select name="discountType" defaultValue={coupon.discountType} className="input">
                <option value="PERCENT">Percentage</option>
                <option value="FIXED">Fixed amount</option>
              </select>
            </label>
            <label className="field-label">
              Value {coupon.discountType === "FIXED" ? `(${symbol})` : "(%)"}
              <input name="value" type="number" min="0" step="0.01" defaultValue={coupon.value} className="input" required />
            </label>
            <label className="field-label">
              Usage limit
              <input name="maxUses" type="number" min="0" step="1" defaultValue={coupon.maxUses} className="input" placeholder="Unlimited" />
            </label>
            <label className="field-label">
              Expires
              <input name="expiresAt" type="date" defaultValue={coupon.expiresAtLocal} className="input" />
            </label>
          </div>
          <label className="flex items-center gap-2.5 rounded-xl border border-line-2 bg-sunken px-3.5 py-2.5 text-[13px] font-medium">
            <input type="checkbox" name="active" defaultChecked={coupon.active} className="size-4 accent-[var(--plum)]" />
            Active — clients can redeem this coupon
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
          <p className="mt-0.5 text-[12.5px] leading-5 text-muted">
            {coupon.usedCount > 0
              ? `This coupon has been redeemed ${coupon.usedCount} times, so it can't be deleted. Deactivate it above instead.`
              : "This coupon has never been redeemed, so it can be deleted outright."}
          </p>
          {coupon.usedCount === 0 ? (
            <form action={deleteCouponAction} className="mt-4">
              <input type="hidden" name="businessSlug" value={businessSlug} />
              <input type="hidden" name="couponId" value={coupon.id} />
              <SubmitButton className="inline-flex items-center gap-1.5 rounded-xl border border-danger/25 bg-danger-soft px-4 py-2.5 text-[13px] font-semibold text-danger hover:bg-danger hover:text-white" pendingText="Deleting…">
                <Trash2 size={14} /> Delete coupon
              </SubmitButton>
            </form>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
