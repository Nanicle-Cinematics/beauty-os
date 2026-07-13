import Link from "next/link";
import { notFound } from "next/navigation";
import { addProductAction, adjustStockAction } from "@/lib/inventory-actions";
import { getInventoryModuleData, type ProductStatus } from "@/lib/inventory-data";
import { requireTenantAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

type InventoryPageProps = {
  params: Promise<{
    businessSlug: string;
  }>;
};

const statusStyles: Record<ProductStatus, string> = {
  OK: "bg-[#eff7f2] text-[#1d7b5d]",
  LOW: "bg-amber-50 text-amber-700",
  OUT: "bg-rose-50 text-rose-700",
  EXPIRING: "bg-amber-50 text-amber-700",
  EXPIRED: "bg-rose-50 text-rose-700",
};

const barStyles: Record<ProductStatus, string> = {
  OK: "bg-emerald-500",
  LOW: "bg-amber-500",
  OUT: "bg-rose-500",
  EXPIRING: "bg-amber-500",
  EXPIRED: "bg-rose-500",
};

export default async function InventoryPage({ params }: InventoryPageProps) {
  const { businessSlug } = await params;
  await requireTenantAccess(businessSlug);
  const data = await getInventoryModuleData(businessSlug);

  if (!data) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#f6f8f6] px-6 py-6 text-[#111b17] max-[720px]:px-3">
      <div className="mx-auto grid max-w-7xl gap-5">
        <header className="flex items-center justify-between gap-4 rounded-3xl border border-[#dbe4de] bg-white px-5 py-4 shadow-[0_18px_45px_rgba(16,38,31,0.08)] max-[720px]:flex-col max-[720px]:items-start">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#1d7b5d]">
              {data.tenant.name}
            </div>
            <h1 className="text-2xl font-black tracking-tight">Inventory</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/${businessSlug}`} className="rounded-2xl border border-[#dbe4de] px-4 py-2 text-sm font-black">
              Dashboard
            </Link>
            <Link href={`/${businessSlug}/services`} className="rounded-2xl border border-[#dbe4de] px-4 py-2 text-sm font-black">
              Services
            </Link>
            <Link href="/logout" className="rounded-2xl border border-[#dbe4de] px-4 py-2 text-sm font-black">
              Sign out
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-4 gap-4 max-[1080px]:grid-cols-2 max-[640px]:grid-cols-1">
          {data.stats.map((stat) => (
            <article key={stat.label} className="rounded-3xl border border-[#dbe4de] bg-white p-5 shadow-[0_12px_35px_rgba(16,38,31,0.05)]">
              <div className="text-xs font-black uppercase tracking-[0.12em] text-[#6b7c73]">
                {stat.label}
              </div>
              <div className="mt-4 text-3xl font-black tracking-tight">{stat.value}</div>
              <div className="mt-2 text-sm font-semibold text-[#6b7c73]">{stat.detail}</div>
            </article>
          ))}
        </section>

        <section className="grid grid-cols-[minmax(0,1fr)_380px] gap-5 max-[1080px]:grid-cols-1">
          <div className="grid gap-5">
            <div className="rounded-[24px] border border-[#dbe4de] bg-white p-5 shadow-[0_12px_35px_rgba(16,38,31,0.06)]">
              <div className="mb-4">
                <h2 className="text-lg font-black">Stock on hand</h2>
                <p className="mt-1 text-sm text-[#6b7c73]">
                  Levels, value, and expiry — adjust stock inline as you use or receive product.
                </p>
              </div>

              {data.products.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#cdddd4] bg-[#f8faf8] px-4 py-10 text-center text-sm font-semibold text-[#6b7c73]">
                  No products yet. Add your first product from the panel on the right.
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-[#dbe4de]">
                  <div className="grid grid-cols-[1.4fr_140px_100px_110px_150px] bg-[#f2f7f4] px-4 py-3 text-[11px] font-black uppercase tracking-[0.12em] text-[#65766d] max-[980px]:hidden">
                    <span>Product</span><span>Level</span><span>Value</span><span>Status</span><span>Adjust</span>
                  </div>
                  {data.products.map((product) => (
                    <div key={product.id} className="grid grid-cols-[1.4fr_140px_100px_110px_150px] items-center gap-3 border-t border-[#e6eee9] px-4 py-4 text-sm max-[980px]:grid-cols-1">
                      <div className="min-w-0">
                        <div className="truncate font-black">{product.name}</div>
                        <div className="mt-1 truncate text-xs font-semibold text-[#6b7c73]">
                          {product.category}
                          {product.supplier !== "—" ? ` · ${product.supplier}` : ""}
                          {product.expiry !== "—" ? ` · exp ${product.expiry}` : ""}
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 text-xs font-bold text-[#6b7c73]">{product.stockLabel}</div>
                        <div className="h-2 rounded-full bg-[#e8f0eb]">
                          <div className={`h-full rounded-full ${barStyles[product.status]}`} style={{ width: `${product.level}%` }} />
                        </div>
                      </div>
                      <div className="font-black">{product.value}</div>
                      <div>
                        <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${statusStyles[product.status]}`}>
                          {product.statusLabel}
                        </span>
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
                          className="h-9 w-16 rounded-xl border border-[#dbe4de] bg-[#f8faf8] px-2 text-sm outline-none focus:border-[#1d7b5d]"
                          required
                        />
                        <button className="h-9 rounded-xl bg-[#10261f] px-3 text-xs font-black text-white">
                          Apply
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-[24px] border border-[#dbe4de] bg-white p-5 shadow-[0_12px_35px_rgba(16,38,31,0.06)]">
              <h2 className="text-lg font-black">Recent stock movements</h2>
              {data.movements.length === 0 ? (
                <p className="mt-3 text-sm text-[#6b7c73]">No stock movements recorded yet.</p>
              ) : (
                <div className="mt-4 overflow-hidden rounded-2xl border border-[#dbe4de]">
                  {data.movements.map((movement) => (
                    <div key={movement.id} className="grid grid-cols-[1.4fr_1fr_80px_90px] items-center gap-3 border-b border-[#e6eee9] px-4 py-3 text-sm last:border-b-0">
                      <span className="font-black">{movement.product}</span>
                      <span className="font-semibold text-[#6b7c73]">{movement.type}</span>
                      <span className={`font-black ${movement.quantity.startsWith("-") ? "text-rose-700" : "text-[#1d7b5d]"}`}>
                        {movement.quantity}
                      </span>
                      <span className="text-right text-xs font-bold text-[#6b7c73]">{movement.when}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <form action={addProductAction} className="rounded-[24px] border border-[#dbe4de] bg-white p-5 shadow-[0_12px_35px_rgba(16,38,31,0.06)]">
            <h2 className="text-lg font-black">Add product</h2>
            <p className="mt-1 text-sm leading-6 text-[#6b7c73]">
              Opening stock is recorded as a movement in {data.tenant.name}.
            </p>

            <input type="hidden" name="businessSlug" value={businessSlug} />

            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-bold">
                Name
                <input name="name" className="h-12 rounded-2xl border border-[#dbe4de] bg-[#f8faf8] px-4 outline-none focus:border-[#1d7b5d]" required />
              </label>

              <label className="grid gap-2 text-sm font-bold">
                Category
                <input name="category" placeholder="e.g. Hair, Nails" className="h-12 rounded-2xl border border-[#dbe4de] bg-[#f8faf8] px-4 outline-none focus:border-[#1d7b5d]" />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-2 text-sm font-bold">
                  Cost price
                  <input name="costPrice" type="number" min="0" step="0.01" className="h-12 rounded-2xl border border-[#dbe4de] bg-[#f8faf8] px-4 outline-none focus:border-[#1d7b5d]" required />
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  Selling price
                  <input name="sellingPrice" type="number" min="0" step="0.01" className="h-12 rounded-2xl border border-[#dbe4de] bg-[#f8faf8] px-4 outline-none focus:border-[#1d7b5d]" />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-2 text-sm font-bold">
                  Opening qty
                  <input name="quantityOnHand" type="number" min="0" step="1" defaultValue={0} className="h-12 rounded-2xl border border-[#dbe4de] bg-[#f8faf8] px-4 outline-none focus:border-[#1d7b5d]" />
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  Reorder at
                  <input name="reorderThreshold" type="number" min="0" step="1" className="h-12 rounded-2xl border border-[#dbe4de] bg-[#f8faf8] px-4 outline-none focus:border-[#1d7b5d]" />
                </label>
              </div>

              <label className="grid gap-2 text-sm font-bold">
                Supplier
                <select name="supplierId" className="h-12 rounded-2xl border border-[#dbe4de] bg-[#f8faf8] px-4 outline-none focus:border-[#1d7b5d]">
                  <option value="">— None —</option>
                  {data.suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>{supplier.label}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-bold">
                Or new supplier
                <input name="newSupplierName" placeholder="e.g. Accra Beauty Supply" className="h-12 rounded-2xl border border-[#dbe4de] bg-[#f8faf8] px-4 outline-none focus:border-[#1d7b5d]" />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-2 text-sm font-bold">
                  Expiry
                  <input name="expiryDate" type="date" className="h-12 rounded-2xl border border-[#dbe4de] bg-[#f8faf8] px-4 outline-none focus:border-[#1d7b5d]" />
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  Barcode
                  <input name="barcode" className="h-12 rounded-2xl border border-[#dbe4de] bg-[#f8faf8] px-4 outline-none focus:border-[#1d7b5d]" />
                </label>
              </div>

              <button className="rounded-2xl bg-[#10261f] px-4 py-3 text-sm font-black text-white">
                Add product
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
