import Link from "next/link";
import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatTile, statMetaFor, EmptyState, Badge } from "@/components/ui";
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
              <h2 className="text-lg font-semibold">Service menu</h2>
              <p className="mt-1 text-sm text-muted">
                Prices, deposits, duration, and the team who can deliver each service.
              </p>
            </div>

            {data.services.length === 0 ? (
              <EmptyState icon={Sparkles} title="No services yet" body="Add your first service from the panel on the right." />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-line">
                <div className="grid grid-cols-[1.5fr_1fr_100px_90px_120px] bg-plum-soft px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted max-[940px]:hidden">
                  <span>Service</span><span>Team</span><span>Duration</span><span>Bookings</span><span>Price</span>
                </div>
                {data.services.map((service) => (
                  <div
                    key={service.id}
                    className={`grid grid-cols-[1.5fr_1fr_100px_90px_120px] items-center gap-3 border-t border-line-2 px-4 py-4 text-sm max-[940px]:grid-cols-1 ${
                      service.isActive ? "" : "opacity-60"
                    }`}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-1 size-3 shrink-0 rounded-full" style={{ backgroundColor: service.colorHex }} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {/* The name is the link, not the row — the row holds a
                              form, and a form inside an anchor is invalid. */}
                          <Link
                            href={`/${businessSlug}/services/${service.id}`}
                            className="font-semibold text-ink hover:text-plum hover:underline"
                          >
                            {service.name}
                          </Link>
                          {!service.isActive ? <Badge tone="neutral">Retired</Badge> : null}
                        </div>
                        <div className="mt-1 text-xs font-semibold text-muted">{service.category}</div>
                      </div>
                    </div>
                    <div className="text-xs font-bold text-muted">
                      {service.staff.length ? service.staff.join(", ") : "Unassigned"}
                    </div>
                    <div className="font-bold">{service.duration}</div>
                    <div className="font-semibold">{service.bookings}</div>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold">{service.price}</div>
                        <div className="text-xs font-semibold text-muted">{service.deposit} dep.</div>
                      </div>
                      <form action={toggleServiceActiveAction}>
                        <input type="hidden" name="businessSlug" value={businessSlug} />
                        <input type="hidden" name="serviceId" value={service.id} />
                        <button className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-muted hover:border-plum-line hover:bg-plum-soft hover:text-plum">
                          {service.isActive ? "Retire" : "Restore"}
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
            <p className="mt-1 text-sm leading-6 text-muted">
              New services become bookable in {data.tenant.name} immediately.
            </p>

            <input type="hidden" name="businessSlug" value={businessSlug} />

            <div className="mt-5 grid gap-4">
              <label className="field-label">
                Name
                <input name="name" className="input" required />
              </label>

              <label className="field-label">
                Description
                <textarea name="description" rows={2} className="input" />
              </label>

              <label className="field-label">
                Price
                <input name="price" type="number" min="0" step="0.01" className="input" required />
                <span className="mt-1 block text-[11.5px] font-normal text-faint">Deposit to confirm is 50% of this, collected automatically.</span>
              </label>

              <div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
                <label className="field-label">
                  Duration (min)
                  <input name="durationMinutes" type="number" min="5" step="5" defaultValue={60} className="input" required />
                </label>
                <label className="field-label">
                  Colour
                  <input name="colorHex" type="color" defaultValue="#6d315f" className="input" />
                </label>
              </div>

              <label className="field-label">
                Category
                <select name="categoryId" className="input">
                  <option value="">— None —</option>
                  {data.categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.label}</option>
                  ))}
                </select>
              </label>

              <label className="field-label">
                Or new category
                <input name="newCategoryName" placeholder="e.g. Bridal" className="input" />
              </label>

              <label className="field-label">
                Assign staff
                <select name="staffIds" multiple size={Math.min(4, Math.max(2, data.staff.length))} className="input">
                  {data.staff.map((member) => (
                    <option key={member.id} value={member.id}>{member.label}</option>
                  ))}
                </select>
                <span className="text-xs font-semibold text-muted">Hold ⌘/Ctrl to select multiple.</span>
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
