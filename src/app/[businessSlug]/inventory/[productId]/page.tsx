import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2, ShieldAlert, PackagePlus, PackageMinus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { getProductDetail } from "@/lib/inventory-data";
import { updateProductAction, adjustStockAction, deleteProductAction } from "@/lib/inventory-actions";
import { requireTenantAccess } from "@/lib/auth";
import { membershipIn, roleCan } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type ProductDetailPageProps = {
  params: Promise<{ businessSlug: string; productId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function ProductDetailPage({ params, searchParams }: ProductDetailPageProps) {
  const { businessSlug, productId } = await params;
  const { error } = await searchParams;
  const user = await requireTenantAccess(businessSlug);

  const [product, membership] = await Promise.all([
    getProductDetail(businessSlug, productId),
    membershipIn(user, businessSlug),
  ]);
  if (!product) notFound();

  const canEdit = roleCan(membership?.role, "inventory:edit");
  const canAdjust = roleCan(membership?.role, "inventory:adjust");
  const canDelete = roleCan(membership?.role, "inventory:delete");
  const symbol = product.currency === "GHS" ? "GH₵" : product.currency;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5">
      <PageHeader title={product.name} description="Product details and stock.">
        <Link
          href={`/${businessSlug}/inventory`}
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

      {!canEdit ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-line bg-sunken px-4 py-3 text-[13px] font-medium text-muted">
          <ShieldAlert size={15} className="shrink-0 text-faint" />
          Your role can view this product but not change it.
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          { label: "On hand", value: product.quantityOnHand },
          { label: "Cost", value: `${symbol} ${product.costPrice}` },
          { label: "Movements", value: String(product.movementCount) },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{s.label}</div>
            <div className="mt-1.5 text-[19px] font-semibold tracking-tight text-ink">{s.value}</div>
          </div>
        ))}
      </section>

      {/* Stock is adjusted through a tracked movement, never by editing the
          on-hand number. The attributes form below deliberately has no quantity
          field — this panel is the only way stock changes. */}
      {canAdjust ? (
        <section className="card p-5">
          <h2 className="text-[15px] font-semibold">Adjust stock</h2>
          <p className="mt-0.5 text-[12.5px] leading-5 text-muted">
            Every change is recorded as a stock movement, so the count always matches the ledger.
          </p>
          <div className="mt-3 flex flex-wrap gap-2.5">
            <form action={adjustStockAction} className="flex flex-wrap items-end gap-2.5">
              <input type="hidden" name="businessSlug" value={businessSlug} />
              <input type="hidden" name="productId" value={product.id} />
              <label className="field-label">
                Change by
                <input name="delta" type="number" step="0.5" placeholder="e.g. 6 or -2" className="input w-[130px]" required />
              </label>
              <label className="field-label flex-1">
                Reason
                <input name="note" className="input" placeholder="Restock, breakage, count correction…" />
              </label>
              <SubmitButton
                className="inline-flex items-center gap-1.5 rounded-xl border border-line px-4 py-2.5 text-[13px] font-semibold text-ink hover:bg-sunken"
                pendingText="Saving…"
              >
                <PackagePlus size={14} /> Apply
              </SubmitButton>
            </form>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-faint">
            <PackageMinus size={12} /> Use a negative number to remove stock (breakage, write-off, correction).
          </p>
        </section>
      ) : null}

      <form action={updateProductAction} className="card grid gap-5 p-5">
        <input type="hidden" name="businessSlug" value={businessSlug} />
        <input type="hidden" name="productId" value={product.id} />
        <fieldset disabled={!canEdit} className="grid gap-5 disabled:opacity-60">
          <div>
            <h2 className="text-[15px] font-semibold">Details</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="field-label sm:col-span-2">
                Name
                <input name="name" defaultValue={product.name} className="input" required />
              </label>
              <label className="field-label">
                Category
                <input name="category" defaultValue={product.category} className="input" />
              </label>
              <label className="field-label">
                Supplier
                <input name="supplier" defaultValue={product.supplier} className="input" placeholder="Type to match or create" />
              </label>
              <label className="field-label">
                SKU
                <input name="sku" defaultValue={product.sku} className="input" />
              </label>
              <label className="field-label">
                Barcode
                <input name="barcode" defaultValue={product.barcode} className="input" />
              </label>
            </div>
          </div>

          <div className="border-t border-line-2 pt-5">
            <h2 className="text-[15px] font-semibold">Pricing &amp; reordering</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <label className="field-label">
                Cost price ({symbol})
                <input name="costPrice" type="number" min="0" step="0.01" defaultValue={product.costPrice} className="input" required />
              </label>
              <label className="field-label">
                Selling price ({symbol})
                <input name="sellingPrice" type="number" min="0" step="0.01" defaultValue={product.sellingPrice} className="input" placeholder="Optional" />
              </label>
              <label className="field-label">
                Reorder at
                <input name="reorderThreshold" type="number" min="0" step="0.5" defaultValue={product.reorderThreshold} className="input" placeholder="No alert" />
              </label>
              <label className="field-label">
                Expiry date
                <input name="expiryDate" type="date" defaultValue={product.expiryDate} className="input" />
              </label>
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
                href={`/${businessSlug}/inventory`}
                className="rounded-2xl border border-line px-5 py-3 text-sm font-semibold text-muted hover:bg-sunken"
              >
                Cancel
              </Link>
            </div>
          ) : null}
        </fieldset>
      </form>

      {canDelete ? (
        <section className="card border-danger/15 p-5">
          <h2 className="text-[15px] font-semibold">Danger zone</h2>
          <p className="mt-0.5 text-[12.5px] leading-5 text-muted">
            {product.movementCount > 0
              ? "This product has stock history, so it can't be deleted. Write its stock down to zero instead."
              : "This product has no stock history, so it can be deleted outright."}
          </p>
          {product.movementCount === 0 ? (
            <form action={deleteProductAction} className="mt-4">
              <input type="hidden" name="businessSlug" value={businessSlug} />
              <input type="hidden" name="productId" value={product.id} />
              <SubmitButton
                className="inline-flex items-center gap-1.5 rounded-xl border border-danger/25 bg-danger-soft px-4 py-2.5 text-[13px] font-semibold text-danger hover:bg-danger hover:text-white"
                pendingText="Deleting…"
              >
                <Trash2 size={14} /> Delete permanently
              </SubmitButton>
            </form>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
