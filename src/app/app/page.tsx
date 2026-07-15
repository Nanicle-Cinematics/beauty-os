import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Settings, LogOut } from "lucide-react";
import { getWorkspaceSummaries } from "@/lib/tenant-data";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const tenantFacts = [
  "Shared login identity",
  "Per-business staff roles",
  "Tenant-scoped data by businessId",
  "Owner platform controls",
];

export default async function WorkspacesPage() {
  const user = await requireUser("/app");
  const workspaces = await getWorkspaceSummaries(user);

  // A regular owner/staff with exactly one workspace has nothing to pick — drop
  // them straight into it. The picker only earns its keep for multi-membership
  // users and the platform admin (who sees every tenant).
  if (!user.isPlatformAdmin && workspaces.length === 1) {
    redirect(`/${workspaces[0].slug}`);
  }

  return (
    <main className="min-h-screen bg-canvas px-6 py-6 text-ink max-[720px]:px-3">
      <div className="mx-auto grid min-h-[calc(100vh-48px)] max-w-6xl content-center gap-6">
        <section className="brand-dark relative overflow-hidden rounded-[28px] p-8 shadow-[var(--shadow-lift)] max-[720px]:p-5">
          <div className="mb-6 flex items-center justify-between gap-3 max-[640px]:flex-col max-[640px]:items-start">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-plum to-wine font-serif text-base font-semibold text-white shadow-[0_6px_18px_rgba(84,33,63,0.4)]">B</span>
              <div className="text-sm text-white/70">
                Signed in as <span className="font-semibold text-white">{user.email}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/settings" className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/10">
                <Settings size={15} /> Settings
              </Link>
              <Link href="/logout" className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/10">
                <LogOut size={15} /> Sign out
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-8 max-[860px]:grid-cols-1">
            <div>
              <div className="mb-4 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-rose">
                Your workspaces
              </div>
              <h1 className="max-w-3xl font-serif text-5xl font-semibold leading-tight tracking-tight max-[720px]:text-3xl">
                Welcome back. Pick a workspace to get to work.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/70">
                Each business has its own staff, clients, services, inventory, payments, and reports.
              </p>
            </div>
            <div className="rounded-2xl border border-white/12 bg-white/[0.06] p-5">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/50">Tenant model</div>
              <div className="mt-4 grid gap-2.5 text-sm font-medium text-white/85">
                {tenantFacts.map((fact) => (
                  <div key={fact} className="rounded-xl bg-white/[0.07] px-3 py-2.5">{fact}</div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-[minmax(0,1fr)_320px] gap-5 max-[980px]:grid-cols-1">
          <div className="card p-5">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Choose workspace</h2>
              <p className="mt-1 text-sm text-muted">Only workspaces your account can access are shown here.</p>
            </div>

            {workspaces.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-plum-softer px-4 py-8 text-center text-sm text-muted">
                No workspaces yet. If you were invited, use the link in your email to activate your account.
              </div>
            ) : (
              <div className="grid gap-3">
                {workspaces.map((workspace) => (
                  <Link
                    key={workspace.slug}
                    href={`/${workspace.slug}`}
                    className="group grid grid-cols-[1fr_auto] items-center gap-4 rounded-2xl border border-line-2 p-4 transition hover:border-plum-line hover:bg-plum-softer max-[640px]:grid-cols-1"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-plum-soft text-[13px] font-semibold text-plum">
                        {workspace.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                      </span>
                      <div>
                        <div className="font-semibold text-ink">{workspace.name}</div>
                        <div className="mt-0.5 text-sm text-muted">{workspace.category} · {workspace.plan}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-plum-soft px-3 py-1 text-xs font-semibold text-plum">{workspace.status}</span>
                      <ArrowRight size={16} className="text-faint transition group-hover:translate-x-0.5 group-hover:text-plum" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <aside className="card p-5">
            <h2 className="text-lg font-semibold">Platform owner</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Manage plans, tenant status, billing, onboarding, support, and system-wide controls.
            </p>
            <Link
              href="/platform"
              className={`mt-5 inline-flex rounded-xl px-4 py-3 text-sm font-semibold ${
                user.isPlatformAdmin
                  ? "bg-gradient-to-r from-plum to-wine text-white shadow-[0_6px_16px_rgba(84,33,63,0.28)]"
                  : "pointer-events-none bg-sunken text-faint"
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
