import Link from "next/link";
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
    <main className="min-h-screen bg-[#fafafa] px-6 py-6 text-[#18181b] max-[720px]:px-3">
      <div className="mx-auto grid max-w-7xl gap-5">
        <header className="flex items-center justify-between gap-4 rounded-3xl border border-[#e7e7ea] bg-white px-5 py-4 shadow-[0_18px_45px_rgba(24,24,27,0.08)] max-[720px]:flex-col max-[720px]:items-start">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6d5cf5]">
              {data.tenant.name}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/${businessSlug}`} className="rounded-2xl border border-[#e7e7ea] px-4 py-2 text-sm font-semibold">
              Dashboard
            </Link>
            <Link href={`/${businessSlug}/appointments`} className="rounded-2xl border border-[#e7e7ea] px-4 py-2 text-sm font-semibold">
              Appointments
            </Link>
            <Link href="/logout" className="rounded-2xl border border-[#e7e7ea] px-4 py-2 text-sm font-semibold">
              Sign out
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-4 gap-4 max-[1080px]:grid-cols-2 max-[640px]:grid-cols-1">
          {data.stats.map((stat) => (
            <article key={stat.label} className="rounded-3xl border border-[#e7e7ea] bg-white p-5 shadow-[0_12px_35px_rgba(24,24,27,0.05)]">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#71717a]">
                {stat.label}
              </div>
              <div className="mt-4 text-3xl font-semibold tracking-tight">{stat.value}</div>
              <div className="mt-2 text-sm font-semibold text-[#71717a]">{stat.detail}</div>
            </article>
          ))}
        </section>

        <section className="grid grid-cols-[minmax(0,1fr)_360px] gap-5 max-[1080px]:grid-cols-1">
          <div className="rounded-[24px] border border-[#e7e7ea] bg-white p-5 shadow-[0_12px_35px_rgba(24,24,27,0.06)]">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Client directory</h2>
              <p className="mt-1 text-sm text-[#71717a]">
                Every client record is scoped to this business only.
              </p>
            </div>

            {data.clients.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#e2e0f7] bg-[#f7f7f8] px-4 py-10 text-center text-sm font-semibold text-[#71717a]">
                No clients yet. Add your first client from the panel on the right.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[#e7e7ea]">
                <div className="grid grid-cols-[1.3fr_1.1fr_90px_100px_120px_110px] bg-[#f4f4f6] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#71717a] max-[940px]:hidden">
                  <span>Client</span><span>Contact</span><span>Visits</span><span>Last visit</span><span>Lifetime</span><span>Owed</span>
                </div>
                {data.clients.map((client) => (
                  <div key={client.id} className="grid grid-cols-[1.3fr_1.1fr_90px_100px_120px_110px] items-center gap-3 border-t border-[#efeff2] px-4 py-4 text-sm max-[940px]:grid-cols-1">
                    <div className="min-w-0">
                      <div className="font-semibold">{client.name}</div>
                      {client.tags.length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {client.tags.map((tag) => (
                            <span key={tag} className="rounded-full bg-[#f6edf0] px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <span className="truncate font-semibold text-[#71717a]">{client.contact}</span>
                    <span className="font-semibold">{client.visits}</span>
                    <span className="font-bold text-[#71717a]">{client.lastVisit}</span>
                    <span className="font-semibold">{client.lifetimeSpend}</span>
                    <span className={`font-semibold ${client.outstandingRaw > 0 ? "text-rose-700" : "text-[#71717a]"}`}>
                      {client.outstanding}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form action={createClientAction} className="rounded-[24px] border border-[#e7e7ea] bg-white p-5 shadow-[0_12px_35px_rgba(24,24,27,0.06)]">
            <h2 className="text-lg font-semibold">Add client</h2>
            <p className="mt-1 text-sm leading-6 text-[#71717a]">
              Creates a client record scoped to {data.tenant.name}.
            </p>

            <input type="hidden" name="businessSlug" value={businessSlug} />

            <div className="mt-5 grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-2 text-sm font-bold">
                  First name
                  <input name="firstName" className="h-12 rounded-2xl border border-[#e7e7ea] bg-[#f7f7f8] px-4 outline-none focus:border-[#6d5cf5]" required />
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  Last name
                  <input name="lastName" className="h-12 rounded-2xl border border-[#e7e7ea] bg-[#f7f7f8] px-4 outline-none focus:border-[#6d5cf5]" />
                </label>
              </div>

              <label className="grid gap-2 text-sm font-bold">
                Phone
                <input name="phone" type="tel" className="h-12 rounded-2xl border border-[#e7e7ea] bg-[#f7f7f8] px-4 outline-none focus:border-[#6d5cf5]" />
              </label>

              <label className="grid gap-2 text-sm font-bold">
                Email
                <input name="email" type="email" className="h-12 rounded-2xl border border-[#e7e7ea] bg-[#f7f7f8] px-4 outline-none focus:border-[#6d5cf5]" />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-2 text-sm font-bold">
                  City
                  <input name="city" className="h-12 rounded-2xl border border-[#e7e7ea] bg-[#f7f7f8] px-4 outline-none focus:border-[#6d5cf5]" />
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  Birthdate
                  <input name="birthdate" type="date" className="h-12 rounded-2xl border border-[#e7e7ea] bg-[#f7f7f8] px-4 outline-none focus:border-[#6d5cf5]" />
                </label>
              </div>

              <label className="grid gap-2 text-sm font-bold">
                Tags
                <input name="tags" placeholder="VIP, bridal, referral" className="h-12 rounded-2xl border border-[#e7e7ea] bg-[#f7f7f8] px-4 outline-none focus:border-[#6d5cf5]" />
                <span className="text-xs font-semibold text-[#71717a]">Comma-separated.</span>
              </label>

              <label className="grid gap-2 text-sm font-bold">
                Skin notes
                <textarea name="skinNotes" rows={2} className="rounded-2xl border border-[#e7e7ea] bg-[#f7f7f8] px-4 py-3 outline-none focus:border-[#6d5cf5]" />
              </label>

              <label className="grid gap-2 text-sm font-bold">
                Allergies
                <textarea name="allergies" rows={2} className="rounded-2xl border border-[#e7e7ea] bg-[#f7f7f8] px-4 py-3 outline-none focus:border-[#6d5cf5]" />
              </label>

              <button className="rounded-2xl bg-[#18181b] px-4 py-3 text-sm font-semibold text-white">
                Add client
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
