import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth";
import { getOnboardingOptions } from "@/lib/onboarding-data";
import { createBusinessAction } from "@/lib/onboarding-actions";

export const dynamic = "force-dynamic";

type OnboardPageProps = {
  searchParams: Promise<{ error?: string }>;
};

const inputClass = "h-12 rounded-2xl border border-[#e9dee5] bg-[#f7f2f5] px-4 outline-none focus:border-[#6d315f]";
const labelClass = "grid gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#796e77]";
const cardClass = "grid gap-4 card p-5";

export default async function OnboardPage({ searchParams }: OnboardPageProps) {
  await requirePlatformAdmin();
  const { error } = await searchParams;
  const { categories, plans, currencies, timezones } = await getOnboardingOptions();

  return (
    <main className="min-h-screen bg-[#fbf7f4] px-6 py-6 text-[#231c22] max-[720px]:px-3">
      <div className="mx-auto grid max-w-3xl gap-5">
        <header className="card flex items-center justify-between gap-4 px-5 py-4 max-[720px]:flex-col max-[720px]:items-start">
          <div className="flex items-center gap-3.5">
            <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-plum to-wine font-serif text-lg font-semibold text-white shadow-[0_6px_18px_rgba(84,33,63,0.4)]">B</span>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-plum">Beauty OS Platform</div>
              <h1 className="text-2xl font-semibold tracking-tight">Onboard a business</h1>
              <p className="mt-0.5 text-sm text-muted">Create a new tenant and its owner account.</p>
            </div>
          </div>
          <Link href="/platform" className="rounded-xl border border-line px-4 py-2 text-sm font-medium hover:bg-sunken">
            Back to portal
          </Link>
        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
            {error}
          </div>
        ) : null}

        <form action={createBusinessAction} className="grid gap-5">
          <section className={cardClass}>
            <div>
              <h2 className="text-lg font-semibold">Business details</h2>
              <p className="mt-1 text-sm text-[#796e77]">Starts on a free trial — assign a plan below if you like.</p>
            </div>

            <label className={labelClass}>
              Business name *
              <input name="name" placeholder="e.g. Accra Glow Studio" className={inputClass} required />
            </label>

            <div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
              <label className={labelClass}>
                Category *
                <select name="categoryId" defaultValue="" className={inputClass} required>
                  <option value="" disabled>Select a category</option>
                  {categories.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                URL slug (optional)
                <input name="slug" placeholder="auto from name" className={inputClass} />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
              <label className={labelClass}>
                Currency
                <select name="currency" defaultValue="GHS" className={inputClass}>
                  {currencies.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Timezone
                <select name="timezone" defaultValue="Africa/Accra" className={inputClass}>
                  {timezones.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
              <label className={labelClass}>
                Contact email (optional)
                <input name="email" type="email" placeholder="hello@business.com" className={inputClass} />
              </label>
              <label className={labelClass}>
                Contact phone (optional)
                <input name="phone" placeholder="+233 …" className={inputClass} />
              </label>
            </div>

            <label className={labelClass}>
              Initial plan (optional)
              <select name="planId" defaultValue="" className={inputClass}>
                <option value="">No plan — trial only</option>
                {plans.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </label>
          </section>

          <section className={cardClass}>
            <div>
              <h2 className="text-lg font-semibold">Owner account</h2>
              <p className="mt-1 text-sm text-[#796e77]">
                We generate a secure invite link so the owner sets their own password — no temporary password to share.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
              <label className={labelClass}>
                Owner name *
                <input name="ownerName" placeholder="Full name" className={inputClass} required />
              </label>
              <label className={labelClass}>
                Owner email *
                <input name="ownerEmail" type="email" placeholder="owner@business.com" className={inputClass} required />
              </label>
            </div>
          </section>

          <div className="flex items-center justify-end gap-3">
            <Link href="/platform" className="rounded-2xl border border-[#e9dee5] px-5 py-3 text-sm font-semibold">
              Cancel
            </Link>
            <button className="rounded-2xl bg-gradient-to-r from-plum to-wine px-6 py-3 text-sm font-semibold text-white">Create business</button>
          </div>
        </form>
      </div>
    </main>
  );
}
