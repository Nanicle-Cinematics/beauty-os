import Link from "next/link";
import { Calendar, Users, IdCard, Package, CreditCard, Megaphone, Check, ArrowRight, Sparkles } from "lucide-react";
import { getPublicPlans } from "@/lib/signup-data";

/**
 * NOTE: this value currently has no effect, and is kept only so the intent is
 * visible if the constraint below ever changes.
 *
 * The root layout reads `cookies()` to resolve the theme, which opts every
 * route in the app into dynamic rendering — `next build` marks this page ƒ, not
 * ●. A dynamic page re-renders on every request regardless of the interval it
 * declares here, so the plan query is cached in `getPublicPlans` instead, where
 * the caching actually applies. See the comment there.
 */
export const revalidate = 86400;

const features = [
  { icon: Calendar, title: "Bookings & calendar", body: "Appointments, deposits, waitlist and reminders — one clear day view per artist." },
  { icon: Users, title: "Client CRM", body: "Profiles, history, skin notes, tags and outstanding balances for every client." },
  { icon: IdCard, title: "Staff & roles", body: "Invite your team, set roles and commissions, and see who's on today." },
  { icon: Package, title: "Inventory", body: "Track stock with a live movement ledger, low-stock and expiry alerts." },
  { icon: CreditCard, title: "Payments", body: "Record payments and deposits, collect what's due, and see the money clearly." },
  { icon: Megaphone, title: "Marketing & loyalty", body: "Campaigns, discount coupons, membership tiers and a points program." },
];

export default async function LandingPage() {
  const plans = await getPublicPlans();

  return (
    <main className="min-h-screen bg-canvas text-ink">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5 max-[720px]:px-4">
        <Link href="/" className="inline-flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-plum to-wine font-serif text-base font-semibold text-white shadow-[0_6px_18px_rgba(84,33,63,0.4)]">
            B
          </span>
          <span className="font-serif text-lg font-semibold tracking-tight">Beauty OS</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link href="/login" className="rounded-xl border border-line bg-card px-4 py-2 text-sm font-medium hover:bg-sunken">Sign in</Link>
          <Link href="/signup" className="rounded-xl bg-gradient-to-r from-plum to-wine px-4 py-2 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(84,33,63,0.28)]">Start 7-day trial</Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-6 pb-14 max-[720px]:px-4">
        <div className="brand-dark relative overflow-hidden rounded-[32px] p-10 shadow-[var(--shadow-lift)] max-[720px]:p-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose">
            <Sparkles size={12} /> The operating system for beauty businesses
          </div>
          <h1 className="mt-5 max-w-3xl font-serif text-6xl font-semibold leading-[1.02] tracking-tight max-[900px]:text-5xl max-[720px]:text-4xl">
            Everything your studio runs on, in one calm place.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
            Bookings, clients, staff, inventory, payments and marketing for salons, makeup artists, lash &amp;
            brow studios, barbershops and spas. Set up in a minute with a strict 7-day free trial.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="inline-flex items-center gap-1.5 rounded-xl bg-white px-6 py-3 text-sm font-semibold shadow-[0_8px_24px_rgba(0,0,0,0.2)] hover:brightness-95" style={{ color: "#1d1220" }}>
              Start your 7-day trial <ArrowRight size={16} />
            </Link>
            <Link href="/login" className="rounded-xl border border-white/20 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10">
              Sign in
            </Link>
          </div>
          <div className="mt-9 grid max-w-4xl grid-cols-[1.2fr_0.9fr_0.9fr] gap-3 max-[900px]:grid-cols-1">
            <div className="rounded-2xl border border-white/12 bg-white/[0.07] p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">Today</span>
                <span className="rounded-full bg-rose/15 px-2 py-0.5 text-[11px] font-bold text-rose">3 bookings</span>
              </div>
              <div className="mt-4 grid gap-2">
                {[
                  ["09:00", "Silk press + trim", "Paid"],
                  ["10:30", "Soft glam", "Deposit due"],
                  ["12:00", "Wig install", "Hold"],
                ].map(([time, service, state]) => (
                  <div key={`${time}-${service}`} className="grid grid-cols-[52px_minmax(0,1fr)_86px] items-center gap-3 rounded-xl bg-white/[0.06] px-3 py-2 text-sm">
                    <span className="font-bold text-rose">{time}</span>
                    <span className="truncate font-semibold text-white">{service}</span>
                    <span className="truncate text-right text-[11px] font-semibold text-white/50">{state}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-white/12 bg-white/[0.07] p-4">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">Collected</span>
              <div className="mt-3 font-serif text-3xl font-semibold">GH₵ 535</div>
              <div className="mt-1 text-sm text-white/55">GH₵ 1,315 still to collect</div>
              <div className="mt-4 h-2 rounded-full bg-white/10">
                <div className="h-2 w-[29%] rounded-full bg-rose" />
              </div>
            </div>
            <div className="rounded-2xl border border-white/12 bg-white/[0.07] p-4">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">Queue</span>
              <div className="mt-3 grid gap-2 text-sm font-semibold">
                <span className="rounded-xl bg-white/[0.06] px-3 py-2 text-white/75">2 unpaid deposits</span>
                <span className="rounded-xl bg-white/[0.06] px-3 py-2 text-white/75">1 hold expiring</span>
                <span className="rounded-xl bg-white/[0.06] px-3 py-2 text-white/75">2 stock alerts</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 pb-16 max-[720px]:px-4">
        <h2 className="font-serif text-3xl font-semibold tracking-tight">One system, every part of the business</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Stop stitching together a booking app, a spreadsheet and a notebook. Beauty OS does it all, per workspace.
        </p>
        <div className="mt-8 grid grid-cols-3 gap-4 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <article key={f.title} className="card p-5 transition hover:shadow-[var(--shadow-lift)]">
                <span className="grid size-10 place-items-center rounded-xl bg-plum-soft text-plum">
                  <Icon size={19} />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{f.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-6xl px-6 pb-16 max-[720px]:px-4">
        <h2 className="font-serif text-3xl font-semibold tracking-tight">Simple pricing</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Start with 7 days free, then pick the plan that fits. Prices in Ghana Cedis, billed monthly or yearly.
        </p>
        <div className="mt-8 grid grid-cols-2 gap-4 max-[720px]:grid-cols-1">
          {plans.map((plan) => (
            <article
              key={plan.key}
              className={`rounded-[24px] p-6 ${
                plan.highlighted
                  ? "brand-dark shadow-[var(--shadow-lift)]"
                  : "border border-line bg-card shadow-[var(--shadow-soft)]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                {plan.highlighted ? (
                  <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-rose">
                    Popular
                  </span>
                ) : null}
              </div>
              <div className="mt-4 flex items-end gap-2">
                <span className="text-4xl font-semibold tracking-tight">{plan.priceMonthly}</span>
                <span className={`pb-1 text-sm font-semibold ${plan.highlighted ? "text-white/60" : "text-muted"}`}>/mo</span>
              </div>
              <div className={`mt-1 text-xs font-medium ${plan.highlighted ? "text-white/55" : "text-faint"}`}>
                or {plan.priceYearly}/yr
              </div>
              <ul className="mt-5 grid gap-2 text-sm font-medium">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-center gap-2">
                    <span className={`grid size-4 shrink-0 place-items-center rounded-full ${plan.highlighted ? "bg-white/20 text-white" : "bg-plum-soft text-plum"}`}>
                      <Check size={11} strokeWidth={3} />
                    </span>
                    {feat}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={`mt-6 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold ${
                  plan.highlighted ? "bg-white" : "bg-gradient-to-r from-plum to-wine text-white"
                }`}
                style={plan.highlighted ? { color: "#1d1220" } : undefined}
              >
                Start 7-day trial
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-6 text-sm text-muted max-[560px]:flex-col max-[560px]:items-start max-[720px]:px-4">
          <span>© {new Date().getFullYear()} Beauty OS · Nanicle Enterprise Solutions</span>
          <div className="flex gap-4">
            <Link href="/login" className="font-medium text-ink hover:text-plum">Sign in</Link>
            <Link href="/signup" className="font-medium text-ink hover:text-plum">Start 7-day trial</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
