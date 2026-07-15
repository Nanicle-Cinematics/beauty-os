import { PageHeader } from "@/components/page-header";
import { notFound } from "next/navigation";
import { createServiceAction, toggleServiceActiveAction } from "@/lib/service-actions";
import { getServiceModuleData } from "@/lib/service-data";
import { requireTenantAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

type ServicesPageProps = {
  params: Promise<{
    businessSlug: string;
  }>;
};

export default async function ServicesPage({ params }: ServicesPageProps) {
  const { businessSlug } = await params;
  await requireTenantAccess(businessSlug);
  const data = await getServiceModuleData(businessSlug);

  if (!data) {
    notFound();
  }

  return (
    <div className="grid gap-5">
      <PageHeader title="Services" description="The menu you sell — pricing, duration, and categories." />

        <section className="grid grid-cols-4 gap-4 max-[1080px]:grid-cols-2 max-[640px]:grid-cols-1">
          {data.stats.map((stat) => (
            <article key={stat.label} className="card p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#796e77]">
                {stat.label}
              </div>
              <div className="mt-4 text-3xl font-bold tracking-tight">{stat.value}</div>
              <div className="mt-2 text-sm font-semibold text-[#796e77]">{stat.detail}</div>
            </article>
          ))}
        </section>

        <section className="grid grid-cols-[minmax(0,1fr)_380px] gap-5 max-[1080px]:grid-cols-1">
          <div className="card p-5">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Service menu</h2>
              <p className="mt-1 text-sm text-[#796e77]">
                Prices, deposits, duration, and the team who can deliver each service.
              </p>
            </div>

            {data.services.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#e9dee5] bg-[#f7f2f5] px-4 py-10 text-center text-sm font-semibold text-[#796e77]">
                No services yet. Add your first service from the panel on the right.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[#e9dee5]">
                <div className="grid grid-cols-[1.5fr_1fr_100px_90px_120px] bg-[#f5eff2] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#796e77] max-[940px]:hidden">
                  <span>Service</span><span>Team</span><span>Duration</span><span>Bookings</span><span>Price</span>
                </div>
                {data.services.map((service) => (
                  <div
                    key={service.id}
                    className={`grid grid-cols-[1.5fr_1fr_100px_90px_120px] items-center gap-3 border-t border-[#f0e8ed] px-4 py-4 text-sm max-[940px]:grid-cols-1 ${
                      service.isActive ? "" : "opacity-60"
                    }`}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-1 size-3 shrink-0 rounded-full" style={{ backgroundColor: service.colorHex }} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{service.name}</span>
                          {!service.isActive ? (
                            <span className="rounded-full bg-[#f0eaee] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#796e77]">
                              Archived
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 text-xs font-semibold text-[#796e77]">{service.category}</div>
                      </div>
                    </div>
                    <div className="text-xs font-bold text-[#796e77]">
                      {service.staff.length ? service.staff.join(", ") : "Unassigned"}
                    </div>
                    <div className="font-bold">{service.duration}</div>
                    <div className="font-semibold">{service.bookings}</div>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold">{service.price}</div>
                        <div className="text-xs font-semibold text-[#796e77]">{service.deposit} dep.</div>
                      </div>
                      <form action={toggleServiceActiveAction}>
                        <input type="hidden" name="businessSlug" value={businessSlug} />
                        <input type="hidden" name="serviceId" value={service.id} />
                        <button className="rounded-xl border border-[#e9dee5] px-3 py-2 text-xs font-semibold">
                          {service.isActive ? "Archive" : "Restore"}
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form action={createServiceAction} className="card p-5">
            <h2 className="text-lg font-semibold">Add service</h2>
            <p className="mt-1 text-sm leading-6 text-[#796e77]">
              New services become bookable in {data.tenant.name} immediately.
            </p>

            <input type="hidden" name="businessSlug" value={businessSlug} />

            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-bold">
                Name
                <input name="name" className="h-12 rounded-2xl border border-[#e9dee5] bg-[#f7f2f5] px-4 outline-none focus:border-[#6d315f]" required />
              </label>

              <label className="grid gap-2 text-sm font-bold">
                Description
                <textarea name="description" rows={2} className="rounded-2xl border border-[#e9dee5] bg-[#f7f2f5] px-4 py-3 outline-none focus:border-[#6d315f]" />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-2 text-sm font-bold">
                  Price
                  <input name="price" type="number" min="0" step="0.01" className="h-12 rounded-2xl border border-[#e9dee5] bg-[#f7f2f5] px-4 outline-none focus:border-[#6d315f]" required />
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  Deposit
                  <input name="depositAmount" type="number" min="0" step="0.01" className="h-12 rounded-2xl border border-[#e9dee5] bg-[#f7f2f5] px-4 outline-none focus:border-[#6d315f]" />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-2 text-sm font-bold">
                  Duration (min)
                  <input name="durationMinutes" type="number" min="5" step="5" defaultValue={60} className="h-12 rounded-2xl border border-[#e9dee5] bg-[#f7f2f5] px-4 outline-none focus:border-[#6d315f]" required />
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  Colour
                  <input name="colorHex" type="color" defaultValue="#6d315f" className="h-12 w-full rounded-2xl border border-[#e9dee5] bg-[#f7f2f5] px-2 outline-none" />
                </label>
              </div>

              <label className="grid gap-2 text-sm font-bold">
                Category
                <select name="categoryId" className="h-12 rounded-2xl border border-[#e9dee5] bg-[#f7f2f5] px-4 outline-none focus:border-[#6d315f]">
                  <option value="">— None —</option>
                  {data.categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.label}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-bold">
                Or new category
                <input name="newCategoryName" placeholder="e.g. Bridal" className="h-12 rounded-2xl border border-[#e9dee5] bg-[#f7f2f5] px-4 outline-none focus:border-[#6d315f]" />
              </label>

              <label className="grid gap-2 text-sm font-bold">
                Assign staff
                <select name="staffIds" multiple size={Math.min(4, Math.max(2, data.staff.length))} className="rounded-2xl border border-[#e9dee5] bg-[#f7f2f5] px-4 py-2 outline-none focus:border-[#6d315f]">
                  {data.staff.map((member) => (
                    <option key={member.id} value={member.id}>{member.label}</option>
                  ))}
                </select>
                <span className="text-xs font-semibold text-[#796e77]">Hold ⌘/Ctrl to select multiple.</span>
              </label>

              <button className="rounded-2xl bg-gradient-to-r from-plum to-wine px-4 py-3 text-sm font-semibold text-white">
                Add service
              </button>
            </div>
          </form>
        </section>
    </div>
  );
}
