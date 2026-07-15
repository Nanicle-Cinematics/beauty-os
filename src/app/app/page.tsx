import Link from "next/link";
import { redirect } from "next/navigation";
import { getWorkspaceSummaries } from "@/lib/tenant-data";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

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
    <main className="min-h-screen bg-[#fafafa] px-6 py-6 text-[#18181b] max-[720px]:px-3">
      <div className="mx-auto grid min-h-[calc(100vh-48px)] max-w-6xl content-center gap-6">
        <section className="rounded-[32px] bg-[#18181b] p-8 text-white shadow-[0_24px_60px_rgba(24,24,27,0.18)] max-[720px]:p-5">
          <div className="mb-6 flex items-center justify-between gap-3 max-[640px]:flex-col max-[640px]:items-start">
            <div className="text-sm font-bold text-white/72">
              Signed in as <span className="text-white">{user.email}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/settings" className="rounded-2xl border border-white/15 px-4 py-2 text-sm font-semibold">
                Settings
              </Link>
              <Link href="/logout" className="rounded-2xl border border-white/15 px-4 py-2 text-sm font-semibold">
                Sign out
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-8 max-[860px]:grid-cols-1">
            <div>
              <div className="mb-4 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6d5cf5]">
                Your workspaces
              </div>
              <h1 className="max-w-3xl text-5xl font-semibold leading-tight tracking-tight max-[720px]:text-3xl">
                Welcome back. Pick a workspace to get to work.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/72">
                Each business has its own staff, clients, services, inventory, payments, and reports.
              </p>
            </div>
            <div className="rounded-3xl border border-white/12 bg-white/10 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
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
          <div className="rounded-[24px] border border-[#e7e7ea] bg-white p-5 shadow-[0_12px_35px_rgba(24,24,27,0.06)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Choose workspace</h2>
                <p className="mt-1 text-sm text-[#71717a]">
                  Only workspaces your account can access are shown here.
                </p>
              </div>
            </div>

            {workspaces.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#e2e0f7] bg-[#f7f7f8] px-4 py-8 text-center text-sm font-semibold text-[#71717a]">
                No workspaces yet. If you were invited, use the link in your email to activate your account.
              </div>
            ) : (
              <div className="grid gap-3">
                {workspaces.map((workspace) => (
                  <Link
                    key={workspace.slug}
                    href={`/${workspace.slug}`}
                    className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-2xl border border-[#efeff2] p-4 transition hover:border-[#6d5cf5] hover:bg-[#f7f7f8] max-[640px]:grid-cols-1"
                  >
                    <div>
                      <div className="font-semibold">{workspace.name}</div>
                      <div className="mt-1 text-sm font-semibold text-[#71717a]">
                        {workspace.category} · {workspace.plan}
                      </div>
                    </div>
                    <span className="w-fit rounded-full bg-[#f1effe] px-3 py-1 text-xs font-semibold text-[#6d5cf5]">
                      {workspace.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <aside className="rounded-[24px] border border-[#e7e7ea] bg-white p-5 shadow-[0_12px_35px_rgba(24,24,27,0.06)]">
            <h2 className="text-lg font-semibold">Platform owner</h2>
            <p className="mt-2 text-sm leading-6 text-[#71717a]">
              Manage plans, tenant status, billing, onboarding, support, and system-wide controls.
            </p>
            <Link
              href="/platform"
              className={`mt-5 inline-flex rounded-2xl px-4 py-3 text-sm font-semibold ${
                user.isPlatformAdmin
                  ? "bg-[#18181b] text-white"
                  : "pointer-events-none bg-[#f2f2f4] text-[#71717a]"
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
