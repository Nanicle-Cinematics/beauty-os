import Link from "next/link";
import { getPlatformBusinesses, getPlatformStats } from "@/lib/tenant-data";
import { requirePlatformAdmin } from "@/lib/auth";

export default async function PlatformPage() {
  const user = await requirePlatformAdmin();
  const [platformStats, businesses] = await Promise.all([
    getPlatformStats(),
    getPlatformBusinesses(),
  ]);

  return (
    <main className="min-h-screen bg-[#f6f8f6] px-6 py-6 text-[#111b17] max-[720px]:px-3">
      <div className="mx-auto grid max-w-7xl gap-5">
        <header className="flex items-center justify-between gap-4 rounded-3xl border border-[#dbe4de] bg-white px-5 py-4 shadow-[0_18px_45px_rgba(16,38,31,0.08)] max-[720px]:flex-col max-[720px]:items-start">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#1d7b5d]">
              Beauty OS Platform
            </div>
            <h1 className="text-2xl font-black tracking-tight">Owner admin portal</h1>
          </div>
          <Link
            href="/logout"
            className="rounded-2xl border border-[#dbe4de] px-4 py-2 text-sm font-black"
          >
            Sign out
          </Link>
        </header>
        <div className="text-sm font-semibold text-[#6b7c73]">
          Signed in as <span className="font-black text-[#111b17]">{user.email}</span>
        </div>

        <section className="grid grid-cols-4 gap-4 max-[1080px]:grid-cols-2 max-[640px]:grid-cols-1">
          {platformStats.map((stat) => (
            <article key={stat.label} className="rounded-3xl border border-[#dbe4de] bg-white p-5 shadow-[0_12px_35px_rgba(16,38,31,0.05)]">
              <div className="text-xs font-black uppercase tracking-[0.12em] text-[#6b7c73]">
                {stat.label}
              </div>
              <div className="mt-4 text-3xl font-black tracking-tight">{stat.value}</div>
              <div className="mt-2 text-sm font-semibold text-[#6b7c73]">{stat.detail}</div>
            </article>
          ))}
        </section>

        <section className="rounded-[24px] border border-[#dbe4de] bg-white p-5 shadow-[0_12px_35px_rgba(16,38,31,0.06)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">Businesses</h2>
              <p className="mt-1 text-sm text-[#6b7c73]">
                Platform-level view across every tenant on the system.
              </p>
            </div>
            <button className="rounded-2xl bg-[#10261f] px-4 py-3 text-sm font-black text-white">
              Add business
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#dbe4de]">
            <div className="grid grid-cols-[1.4fr_1fr_1fr_90px_120px] bg-[#f2f7f4] px-4 py-3 text-[11px] font-black uppercase tracking-[0.12em] text-[#65766d] max-[760px]:hidden">
              <span>Name</span><span>Slug</span><span>Plan</span><span>Users</span><span>Status</span>
            </div>
            {businesses.map((business) => (
              <div key={business.slug} className="grid grid-cols-[1.4fr_1fr_1fr_90px_120px] items-center gap-3 border-t border-[#e6eee9] px-4 py-4 text-sm max-[760px]:grid-cols-1">
                <Link href={`/${business.slug}`} className="font-black text-[#10261f]">
                  {business.name}
                </Link>
                <span className="font-semibold text-[#6b7c73]">{business.slug}</span>
                <span className="font-bold">{business.plan}</span>
                <span className="font-black">{business.users}</span>
                <span className="w-fit rounded-full bg-[#eff7f2] px-3 py-1 text-xs font-black text-[#1d7b5d]">
                  {business.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
