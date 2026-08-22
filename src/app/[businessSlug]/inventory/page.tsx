import Link from "next/link";
import { Package, ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Combobox } from "@/components/combobox";
import { SubmitButton } from "@/components/submit-button";
import { StatTile, statMetaFor, EmptyState, Badge, toneForStatus } from "@/components/ui";
import { notFound } from "next/navigation";
import { addProductAction, adjustStockAction } from "@/lib/inventory-actions";
import { getInventoryModuleData, type ProductStatus } from "@/lib/inventory-data";
import { requireTenantAccess } from "@/lib/auth";
import { industryCopy } from "@/lib/industry";

export const dynamic = "force-dynamic";

type InventoryPageProps = {
  params: Promise<{
    businessSlug: string;
  }>;
};

const barStyles: Record<ProductStatus, string> = {
  OK: "bg-success",
  LOW: "bg-warning",
  OUT: "bg-danger",
  EXPIRING: "bg-warning",
  EXPIRED: "bg-danger",
};

export default async function InventoryPage({ params }: InventoryPageProps) {
  const { businessSlug } = await params;
  await requireTenantAccess(businessSlug, { module: "inventory" });
  const data = await getInventoryModuleData(businessSlug);

  if (!data) {
    notFound();
  }
  const copy = industryCopy(data.tenant.categoryKey);

  return (
    <div className="grid gap-5">
      <PageHeader title={copy.pages.inventoryTitle} description={copy.pages.inventoryDescription} />

        <section className="grid grid-cols-4 gap-4 max-[1080px]:grid-cols-2 max-[640px]:grid-cols-1">
          {data.stats.map((stat) => {
            const meta = statMetaFor(stat.label);
            return (
              <StatTile key={stat.label} label={stat.label} value={stat.value} detail={stat.detail} icon={meta.icon} tone={meta.tone} />
            );
          })}
        </section>

        <section className="grid gap-5">
          <div className="grid gap-5">
            <div className="card p-5">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">{copy.pages.inventoryListTitle}</h2>
                <p className="mt-1 text-sm text-muted">
                  {copy.pages.inventoryListDescription}
                </p>
              </div>

              {data.products.length === 0 ? (
                <EmptyState icon={Package} title={`No ${copy.nav.inventory.toLowerCase()} yet`} body={`Add your first item using ${copy.pages.addInventoryTitle} below.`} />
              ) : (
                <div className="glass-panel overflow-hidden rounded-[26px]">
                  <div className="grid grid-cols-[1.4fr_140px_100px_110px_150px] gap-3 bg-plum-soft px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted max-[980px]:hidden">
                    <span>{copy.nav.inventory === "Gear" ? "Item" : "Product"}</span><span>Level</span><span>Value</span><span>Status</span><span>Adjust</span>
                  </div>
                  {data.products.map((product) => (
                    <div key={product.id} className="grid grid-cols-[1.4fr_140px_100px_110px_150px] items-center gap-3 border-t border-line-2 px-4 py-4 text-sm max-[980px]:grid-cols-1">
                      <div className="min-w-0">
                        <Link href={`/${businessSlug}/inventory/${product.id}`} className="truncate font-semibold hover:text-plum hover:underline">
                          {product.name}
                        </Link>
                        <div className="mt-1 truncate text-xs font-semibold text-muted">
                          {product.category}
                          {product.supplier !== "—" ? ` · ${product.supplier}` : ""}
                          {product.expiry !== "—" ? ` · exp ${product.expiry}` : ""}
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 text-xs font-bold text-muted">{product.stockLabel}</div>
                        <div className="h-2 rounded-full bg-line-2">
                          <div className={`h-full rounded-full ${barStyles[product.status]}`} style={{ width: `${product.level}%` }} />
                        </div>
                      </div>
                      <div className="font-semibold">{product.value}</div>
                      <div>
                        <Badge tone={toneForStatus(product.statusLabel)}>{product.statusLabel}</Badge>
                      </div>
                      <form action={adjustStockAction} className="flex items-center gap-1">
                        <input type="hidden" name="businessSlug" value={businessSlug} />
                        <input type="hidden" name="productId" value={product.id} />
                        <input
                          name="delta"
                          type="number"
                          step="1"
                          placeholder="+/-"
                          aria-label={`Adjust ${product.name} stock`}
                          className="h-9 w-16 rounded-[18px] border border-white/60 bg-white/42 px-2 text-sm outline-none focus:border-plum"
                          required
                        />
                        <button className="h-9 rounded-xl primary-action px-3 text-xs font-semibold text-white">
                          Apply
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card p-5">
              <h2 className="text-lg font-semibold">Recent stock movements</h2>
              {data.movements.length === 0 ? (
                <p className="mt-3 text-sm text-muted">No stock movements recorded yet.</p>
              ) : (
                <div className="mt-4 glass-panel overflow-hidden rounded-[26px]">
                  {data.movements.map((movement) => (
                    <div key={movement.id} className="grid grid-cols-[1.4fr_1fr_80px_90px] items-center gap-3 border-b border-line-2 px-4 py-3 text-sm last:border-b-0 max-[560px]:grid-cols-[1fr_auto]">
                      <span className="font-semibold">{movement.product}</span>
                      <span className="font-semibold text-muted max-[560px]:order-3 max-[560px]:text-xs">{movement.type}</span>
                      <span className={`font-semibold max-[560px]:order-4 max-[560px]:text-right ${movement.quantity.startsWith("-") ? "text-rose-700" : "text-plum"}`}>
                        {movement.quantity}
                      </span>
                      <span className="text-right text-xs font-bold text-muted max-[560px]:order-2">{movement.when}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <details id="add-product" className="group card overflow-hidden p-0">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden">
              <div>
                <h2 className="text-lg font-semibold">{copy.pages.addInventoryTitle}</h2>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Opening stock is recorded as a movement in {data.tenant.name}.
                </p>
              </div>
              <ChevronDown size={18} className="shrink-0 text-muted transition-transform group-open:rotate-180" />
            </summary>
            <form action={addProductAction} className="grid gap-4 border-t border-line-2 p-5">
              <input type="hidden" name="businessSlug" value={businessSlug} />
              <label className="field-label">
                Name
                <input name="name" className="input" required />
              </label>

              <label className="field-label">
                Category
                  <input name="category" placeholder={copy.pages.addInventoryCategoryPlaceholder} className="input" />
              </label>

              <div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
                <label className="field-label">
                  Cost price
                  <input name="costPrice" type="number" min="0" step="0.01" className="input" required />
                </label>
                <label className="field-label">
                  Selling price
                  <input name="sellingPrice" type="number" min="0" step="0.01" className="input" />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
                <label className="field-label">
                  Opening qty
                  <input name="quantityOnHand" type="number" min="0" step="1" defaultValue={0} className="input" />
                </label>
                <label className="field-label">
                  Reorder at
                  <input name="reorderThreshold" type="number" min="0" step="1" className="input" />
                </label>
              </div>

              <label className="field-label">
                Supplier (optional)
                <Combobox name="supplier" options={data.suppliers.map((supplier) => supplier.label)} placeholder="Search or type a new supplier…" />
              </label>

              <div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
                <label className="field-label">
                  Expiry
                  <input name="expiryDate" type="date" className="input" />
                </label>
                <label className="field-label">
                  Barcode
                  <input name="barcode" className="input" />
                </label>
              </div>

              <SubmitButton className="rounded-2xl primary-action px-4 py-3 text-sm font-semibold text-white" pendingText="Adding…">
                Add product
              </SubmitButton>
            </form>
          </details>
        </section>
    </div>
  );
}
