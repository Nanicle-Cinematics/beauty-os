import { Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatTile, statMetaFor, EmptyState, Avatar } from "@/components/ui";
import { notFound } from "next/navigation";
import { createClientAction } from "@/lib/client-actions";
import { getClientModuleData } from "@/lib/client-data";
import { requireTenantAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

type ClientsPageProps = {
  params: Promise<{
    businessSlug: string;
  }>;
};

export default async function ClientsPage({ params }: ClientsPageProps) {
  const { businessSlug } = await params;
  await requireTenantAccess(businessSlug);
  const data = await getClientModuleData(businessSlug);

  if (!data) {
    notFound();
  }

  return (
    <div className="grid gap-5">
      <PageHeader title="Clients" description="Your client book — visit history, spend, and who to bring back." />

        <section className="grid grid-cols-4 gap-4 max-[1080px]:grid-cols-2 max-[640px]:grid-cols-1">
          {data.stats.map((stat) => {
            const meta = statMetaFor(stat.label);
            return (
              <StatTile key={stat.label} label={stat.label} value={stat.value} detail={stat.detail} icon={meta.icon} tone={meta.tone} />
            );
          })}
        </section>

        <section className="grid grid-cols-[minmax(0,1fr)_360px] gap-5 max-[1080px]:grid-cols-1">
          <div className="card p-5">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Client directory</h2>
              <p className="mt-1 text-sm text-muted">
                Every client record is scoped to this business only.
              </p>
            </div>

            {data.clients.length === 0 ? (
              <EmptyState icon={Users} title="No clients yet" body="Add your first client from the panel on the right." />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-line">
                <div className="grid grid-cols-[1.3fr_1.1fr_90px_100px_120px_110px] bg-plum-soft px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted max-[940px]:hidden">
                  <span>Client</span><span>Contact</span><span>Visits</span><span>Last visit</span><span>Lifetime</span><span>Owed</span>
                </div>
                {data.clients.map((client) => (
                  <div key={client.id} className="grid grid-cols-[1.3fr_1.1fr_90px_100px_120px_110px] items-center gap-3 border-t border-line-2 px-4 py-4 text-sm max-[940px]:grid-cols-1">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={client.name} />
                      <div className="min-w-0">
                        <div className="font-semibold text-ink">{client.name}</div>
                        {client.tags.length > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {client.tags.map((tag) => (
                              <span key={tag} className="rounded-full bg-plum-soft px-2 py-0.5 text-[10.5px] font-semibold text-plum">
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <span className="truncate font-medium text-muted">{client.contact}</span>
                    <span className="font-semibold">{client.visits}</span>
                    <span className="font-bold text-muted">{client.lastVisit}</span>
                    <span className="font-semibold">{client.lifetimeSpend}</span>
                    <span className={`font-semibold ${client.outstandingRaw > 0 ? "text-rose-700" : "text-muted"}`}>
                      {client.outstanding}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form action={createClientAction} className="card p-5">
            <h2 className="text-lg font-semibold">Add client</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Creates a client record scoped to {data.tenant.name}.
            </p>

            <input type="hidden" name="businessSlug" value={businessSlug} />

            <div className="mt-5 grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="field-label">
                  First name
                  <input name="firstName" className="input" required />
                </label>
                <label className="field-label">
                  Last name
                  <input name="lastName" className="input" />
                </label>
              </div>

              <label className="field-label">
                Phone
                <input name="phone" type="tel" className="input" />
              </label>

              <label className="field-label">
                Email
                <input name="email" type="email" className="input" />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="field-label">
                  City
                  <input name="city" className="input" />
                </label>
                <label className="field-label">
                  Birthdate
                  <input name="birthdate" type="date" className="input" />
                </label>
              </div>

              <label className="field-label">
                Tags
                <input name="tags" placeholder="VIP, bridal, referral" className="input" />
                <span className="text-xs font-semibold text-muted">Comma-separated.</span>
              </label>

              <label className="field-label">
                Skin notes
                <textarea name="skinNotes" rows={2} className="input" />
              </label>

              <label className="field-label">
                Allergies
                <textarea name="allergies" rows={2} className="input" />
              </label>

              <button className="rounded-2xl bg-gradient-to-r from-plum to-wine px-4 py-3 text-sm font-semibold text-white">
                Add client
              </button>
            </div>
          </form>
        </section>
    </div>
  );
}
