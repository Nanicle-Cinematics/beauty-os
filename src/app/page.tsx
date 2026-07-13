import Link from "next/link";
import { getWorkspaceSummaries } from "@/lib/tenant-data";
import { requireUser } from "@/lib/auth";

export default async function Home() {
  const user = await requireUser("/");
  const workspaces = await getWorkspaceSummaries(user);

  return (
    <main className="min-h-screen bg-[#f6f8f6] px-6 py-6 text-[#111b17] max-[720px]:px-3">
      <div className="mx-auto grid min-h-[calc(100vh-48px)] max-w-6xl content-center gap-6">
        <section className="rounded-[32px] bg-[#10261f] p-8 text-white shadow-[0_24px_60px_rgba(16,38,31,0.18)] max-[720px]:p-5">
          <div className="mb-6 flex items-center justify-between gap-3 max-[640px]:flex-col max-[640px]:items-start">
            <div className="text-sm font-bold text-white/72">
              Signed in as <span className="text-white">{user.email}</span>
            </div>
            <Link href="/logout" className="rounded-2xl border border-white/15 px-4 py-2 text-sm font-black">
              Sign out
            </Link>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-8 max-[860px]:grid-cols-1">
            <div>
              <div className="mb-4 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#f2c66d]">
                Multi-tenant SaaS
              </div>
              <h1 className="max-w-3xl text-5xl font-black leading-tight tracking-tight max-[720px]:text-3xl">
                Beauty OS runs every studio as a separate, secure workspace.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/72">
                Each business has its own staff, clients, services, inventory, payments, and reports, while the platform owner manages all tenants from one admin portal.
              </p>
            </div>
            <div className="rounded-3xl border border-white/12 bg-white/10 p-5">
              <div className="text-xs font-black uppercase tracking-[0.14em] text-white/55">
                Tenant model
              </div>
              <div className="mt-5 grid gap-3 text-sm font-bold text-white/82">
                <div className="rounded-2xl bg-white/10 p-3">Shared login identity</div>
                <div className="rounded-2xl bg-white/10 p-3">Per-business staff roles</div>
                <div className="rounded-2xl bg-white/10 p-3">Tenant-scoped data by businessId</div>
                <div className="rounded-2xl bg-white/10 p-3">Owner platform controls</div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-[minmax(0,1fr)_320px] gap-5 max-[980px]:grid-cols-1">
          <div className="rounded-[24px] border border-[#dbe4de] bg-white p-5 shadow-[0_12px_35px_rgba(16,38,31,0.06)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">Choose workspace</h2>
                <p className="mt-1 text-sm text-[#6b7c73]">
                  Only workspaces your account can access are shown here.
                </p>
              </div>
            </div>

            <div className="grid gap-3">
              {workspaces.map((workspace) => (
                <Link
                  key={workspace.slug}
                  href={`/${workspace.slug}`}
                  className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-2xl border border-[#e6eee9] p-4 transition hover:border-[#1d7b5d] hover:bg-[#f8fbf9] max-[640px]:grid-cols-1"
                >
                  <div>
                    <div className="font-black">{workspace.name}</div>
                    <div className="mt-1 text-sm font-semibold text-[#6b7c73]">
                      {workspace.category} · {workspace.plan}
                    </div>
                  </div>
                  <span className="w-fit rounded-full bg-[#eff7f2] px-3 py-1 text-xs font-black text-[#1d7b5d]">
                    {workspace.status}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <aside className="rounded-[24px] border border-[#dbe4de] bg-white p-5 shadow-[0_12px_35px_rgba(16,38,31,0.06)]">
            <h2 className="text-lg font-black">Platform owner</h2>
            <p className="mt-2 text-sm leading-6 text-[#6b7c73]">
              Manage plans, tenant status, billing, onboarding, support, and system-wide controls.
            </p>
            <Link
              href="/platform"
              className={`mt-5 inline-flex rounded-2xl px-4 py-3 text-sm font-black ${
                user.isPlatformAdmin
                  ? "bg-[#10261f] text-white"
                  : "pointer-events-none bg-[#e8f0eb] text-[#6b7c73]"
              }`}
            >
              {user.isPlatformAdmin ? "Open admin portal" : "Admin only"}
            </Link>
          </aside>
        </section>
      </div>
    </main>
  );
}
