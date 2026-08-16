import Link from "next/link";
import { Sparkles, ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatTile, statMetaFor, EmptyState, Badge } from "@/components/ui";
import { notFound } from "next/navigation";
import { createServiceAction, toggleServiceActiveAction } from "@/lib/service-actions";
import { getServiceModuleData } from "@/lib/service-data";
import { requireTenantAccess } from "@/lib/auth";
import { industryCopy } from "@/lib/industry";

export const dynamic = "force-dynamic";

type ServicesPageProps = {
  params: Promise<{
    businessSlug: string;
  }>;
  searchParams: Promise<{ new?: string }>;
};

export default async function ServicesPage({ params, searchParams }: ServicesPageProps) {
  const { businessSlug } = await params;
  const { new: newParam } = await searchParams;
  const showNew = newParam === "1";
  await requireTenantAccess(businessSlug);
  const data = await getServiceModuleData(businessSlug);

  if (!data) {
    notFound();
  }
  const copy = industryCopy(data.tenant.categoryKey);
  const isPackagesPage = copy.nav.services === "Packages";

  return (
    <div className="grid gap-5">
      {!isPackagesPage ? (
        <PageHeader title={copy.pages.serviceTitle} description={copy.pages.serviceDescription} />
      ) : null}

        <section className="grid grid-cols-4 gap-4 max-[1080px]:grid-cols-2 max-[640px]:grid-cols-1">
          {data.stats.map((stat) => {
            const meta = statMetaFor(stat.label);
            return (
              <StatTile key={stat.label} label={stat.label} value={stat.value} detail={stat.detail} icon={meta.icon} tone={meta.tone} />
            );
          })}
        </section>

        <section className="grid gap-5">
          <div className="card p-5">
            <div className="mb-4">
                <h2 className="text-lg font-semibold">{copy.pages.serviceMenuTitle}</h2>
                <p className="mt-1 text-sm text-muted">
                  {copy.pages.serviceMenuDescription}
                </p>
            </div>

            {data.services.length === 0 ? (
              <EmptyState icon={Sparkles} title={`No ${copy.nav.services.toLowerCase()} yet`} body={`Add your first ${copy.nav.services.toLowerCase().slice(0, -1)} using ${copy.pages.addServiceTitle} below.`} />
            ) : (
              <div className="glass-panel overflow-hidden rounded-[26px]">
                <div className="grid grid-cols-[1.5fr_1fr_100px_90px_120px_92px] gap-3 bg-plum-soft px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted max-[940px]:hidden">
                  <span>{copy.nav.services === "Packages" ? "Package" : "Service"}</span><span>{copy.nav.staff === "Crew" ? "Crew" : "Team"}</span><span>Duration</span><span>Bookings</span><span>Price</span><span></span>
                </div>
                {data.services.map((service) => (
                  <div
                    key={service.id}
                    className={`grid grid-cols-[1.5fr_1fr_100px_90px_120px_92px] items-center gap-3 border-t border-line-2 px-4 py-4 text-sm max-[940px]:grid-cols-1 max-[940px]:border-t-4 max-[940px]:border-line ${
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
                            className={`${isPackagesPage ? "text-xl sm:text-lg" : "text-sm"} font-semibold leading-tight text-ink hover:text-plum hover:underline`}
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
                    <div className="whitespace-nowrap">
                      <div className="font-semibold">{service.price}</div>
                      <div className="text-xs font-semibold text-muted">{service.deposit} dep.</div>
                    </div>
                    <form action={toggleServiceActiveAction} className="flex justify-end max-[940px]:justify-start">
                      <input type="hidden" name="businessSlug" value={businessSlug} />
                      <input type="hidden" name="serviceId" value={service.id} />
                      <button className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-muted hover:border-plum-line hover:bg-plum-soft hover:text-plum">
                        {service.isActive ? "Retire" : "Restore"}
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </div>

          <details id="add-service" open={showNew} className="group card overflow-hidden p-0">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden">
              <div>
                <h2 className="text-lg font-semibold">{copy.pages.addServiceTitle}</h2>
                <p className="mt-1 text-sm leading-6 text-muted">
                  New {copy.nav.services.toLowerCase()} become bookable in {data.tenant.name} immediately.
                </p>
              </div>
              <ChevronDown size={18} className="shrink-0 text-muted transition-transform group-open:rotate-180" />
            </summary>
            <form action={createServiceAction} className="grid gap-4 border-t border-line-2 p-5">
              <input type="hidden" name="businessSlug" value={businessSlug} />
              <label className="field-label">
                {copy.nav.services === "Packages" ? "Package name" : "Name"}
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
                Assign {copy.nav.staff.toLowerCase()}
                <select name="staffIds" multiple size={Math.min(4, Math.max(2, data.staff.length))} className="input">
                  {data.staff.map((member) => (
                    <option key={member.id} value={member.id}>{member.label}</option>
                  ))}
                </select>
                <span className="text-xs font-semibold text-muted">Hold ⌘/Ctrl to select multiple.</span>
              </label>

              <button className="rounded-2xl primary-action px-4 py-3 text-sm font-semibold text-white">
                Add service
              </button>
            </form>
          </details>
        </section>
    </div>
  );
}
