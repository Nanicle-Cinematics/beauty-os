import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth";
import { getOnboardingOptions } from "@/lib/onboarding-data";
import { createBusinessAction } from "@/lib/onboarding-actions";

export const dynamic = "force-dynamic";

type OnboardPageProps = {
  searchParams: Promise<{ error?: string }>;
};

const inputClass = "h-12 rounded-2xl border border-[#dbe4de] bg-[#f8faf8] px-4 outline-none focus:border-[#1d7b5d]";
const labelClass = "grid gap-1.5 text-xs font-black uppercase tracking-[0.12em] text-[#6b7c73]";
const cardClass = "grid gap-4 rounded-[24px] border border-[#dbe4de] bg-white p-5 shadow-[0_12px_35px_rgba(16,38,31,0.06)]";

export default async function OnboardPage({ searchParams }: OnboardPageProps) {
  await requirePlatformAdmin();
  const { error } = await searchParams;
  const { categories, plans, currencies, timezones } = await getOnboardingOptions();

  return (
    <main className="min-h-screen bg-[#f6f8f6] px-6 py-6 text-[#111b17] max-[720px]:px-3">
      <div className="mx-auto grid max-w-3xl gap-5">
        <header className="flex items-center justify-between gap-4 rounded-3xl border border-[#dbe4de] bg-white px-5 py-4 shadow-[0_18px_45px_rgba(16,38,31,0.08)] max-[720px]:flex-col max-[720px]:items-start">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#1d7b5d]">Beauty OS Platform</div>
            <h1 className="text-2xl font-black tracking-tight">Onboard a business</h1>
            <p className="mt-1 text-sm font-semibold text-[#6b7c73]">Create a new tenant and its owner account.</p>
          </div>
          <Link href="/platform" className="rounded-2xl border border-[#dbe4de] px-4 py-2 text-sm font-black">
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
              <h2 className="text-lg font-black">Business details</h2>
              <p className="mt-1 text-sm text-[#6b7c73]">Starts on a free trial — assign a plan below if you like.</p>
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
              <h2 className="text-lg font-black">Owner account</h2>
              <p className="mt-1 text-sm text-[#6b7c73]">The owner signs in with this email and password.</p>
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

            <label className={labelClass}>
              Temporary password * (min 8 characters)
              <input name="ownerPassword" type="text" minLength={8} placeholder="Share this with the owner" className={inputClass} required />
            </label>
          </section>

          <div className="flex items-center justify-end gap-3">
            <Link href="/platform" className="rounded-2xl border border-[#dbe4de] px-5 py-3 text-sm font-black">
              Cancel
            </Link>
            <button className="rounded-2xl bg-[#10261f] px-6 py-3 text-sm font-black text-white">Create business</button>
          </div>
        </form>
      </div>
    </main>
  );
}
