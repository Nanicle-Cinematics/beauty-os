import Link from "next/link";
import { getPublicPlans } from "@/lib/signup-data";

export const dynamic = "force-dynamic";

const features = [
  { title: "Bookings & calendar", body: "Appointments, deposits, waitlist and reminders — one clear day view per artist." },
  { title: "Client CRM", body: "Profiles, history, skin notes, tags and outstanding balances for every client." },
  { title: "Staff & roles", body: "Invite your team, set roles and commissions, and see who's on today." },
  { title: "Inventory", body: "Track stock with a live movement ledger, low-stock and expiry alerts." },
  { title: "Payments", body: "Record payments and deposits, collect what's due, and see the money clearly." },
  { title: "Marketing & loyalty", body: "Campaigns, discount coupons, membership tiers and a points program." },
];

export default async function LandingPage() {
  const plans = await getPublicPlans();

  return (
    <main className="min-h-screen bg-[#fafafa] text-[#18181b]">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5 max-[720px]:px-4">
        <Link href="/" className="inline-flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-[#18181b] text-sm font-semibold text-[#9d4e7a]">BO</span>
          <span className="text-lg font-semibold tracking-tight">Beauty OS</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link href="/login" className="rounded-2xl border border-[#e7e7ea] bg-white px-4 py-2 text-sm font-semibold">Sign in</Link>
          <Link href="/signup" className="rounded-2xl bg-[#18181b] px-4 py-2 text-sm font-semibold text-white">Start free</Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-6 pb-14 max-[720px]:px-4">
        <div className="rounded-[36px] bg-[#18181b] p-10 text-white shadow-[0_30px_70px_rgba(24,24,27,0.22)] max-[720px]:p-6">
          <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9d4e7a]">
            The operating system for beauty businesses
          </div>
          <h1 className="mt-5 max-w-3xl text-6xl font-semibold leading-[1.02] tracking-tight max-[900px]:text-5xl max-[720px]:text-4xl">
            Everything your studio runs on, in one calm place.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/75">
            Bookings, clients, staff, inventory, payments and marketing for salons, makeup artists, lash &amp;
            brow studios, barbershops and spas. Set up in a minute — free while you trial.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="rounded-2xl bg-[#9d4e7a] px-6 py-3 text-sm font-semibold text-white">
              Start your free trial
            </Link>
            <Link href="/login" className="rounded-2xl border border-white/20 px-6 py-3 text-sm font-semibold text-white">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 pb-16 max-[720px]:px-4">
        <h2 className="text-3xl font-semibold tracking-tight">One system, every part of the business</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#71717a]">
          Stop stitching together a booking app, a spreadsheet and a notebook. Beauty OS does it all, per workspace.
        </p>
        <div className="mt-8 grid grid-cols-3 gap-4 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
          {features.map((f) => (
            <article key={f.title} className="rounded-[24px] border border-[#e7e7ea] bg-white p-5 shadow-[0_12px_35px_rgba(24,24,27,0.05)]">
              <div className="h-1.5 w-9 rounded-full bg-[#9d4e7a]" />
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#71717a]">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-6xl px-6 pb-16 max-[720px]:px-4">
        <h2 className="text-3xl font-semibold tracking-tight">Simple pricing</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#71717a]">
          Start free, then pick the plan that fits. Prices in Ghana Cedis, billed monthly or yearly.
        </p>
        <div className="mt-8 grid grid-cols-2 gap-4 max-[720px]:grid-cols-1">
          {plans.map((plan) => (
            <article
              key={plan.key}
              className={`rounded-[28px] border p-6 ${
                plan.highlighted
                  ? "border-[#18181b] bg-[#18181b] text-white shadow-[0_24px_60px_rgba(24,24,27,0.18)]"
                  : "border-[#e7e7ea] bg-white shadow-[0_12px_35px_rgba(24,24,27,0.05)]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                {plan.highlighted ? (
                  <span className="rounded-full bg-[#9d4e7a] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white">
                    Popular
                  </span>
                ) : null}
              </div>
              <div className="mt-4 flex items-end gap-2">
                <span className="text-4xl font-semibold tracking-tight">{plan.priceMonthly}</span>
                <span className={`pb-1 text-sm font-bold ${plan.highlighted ? "text-white/60" : "text-[#71717a]"}`}>/mo</span>
              </div>
              <div className={`mt-1 text-xs font-bold ${plan.highlighted ? "text-white/55" : "text-[#a1a1aa]"}`}>
                or {plan.priceYearly}/yr
              </div>
              <ul className="mt-5 grid gap-2 text-sm font-semibold">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-center gap-2">
                    <span className={`grid size-4 place-items-center rounded-full text-[10px] font-semibold ${plan.highlighted ? "bg-[#9d4e7a] text-white" : "bg-[#faf1f6] text-[#9d4e7a]"}`}>✓</span>
                    {feat}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={`mt-6 inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold ${
                  plan.highlighted ? "bg-[#9d4e7a] text-white" : "bg-[#18181b] text-white"
                }`}
              >
                Start free trial
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#e7e7ea]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-6 text-sm font-semibold text-[#71717a] max-[560px]:flex-col max-[560px]:items-start max-[720px]:px-4">
          <span>© {new Date().getFullYear()} Beauty OS</span>
          <div className="flex gap-4">
            <Link href="/login" className="font-semibold text-[#18181b]">Sign in</Link>
            <Link href="/signup" className="font-semibold text-[#18181b]">Start free</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
