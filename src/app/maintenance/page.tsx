import { Wrench, ShieldCheck, Clock } from "lucide-react";

// Same customer-facing inbox as /trial-expired: someone who cannot get into
// their salon needs a human who can actually tell them what is happening.
const SUPPORT_EMAIL = "degraftnanaaboagye@gmail.com";

// Kept as a constant rather than inlined so there is exactly one place to edit
// when the return date moves. Rendered from a fixed string, never from `new
// Date()` — a countdown that silently expires is worse than a plain date.
const EXPECTED_BACK = "1 September 2026";

export const metadata = {
  title: "Beauty OS is temporarily unavailable",
  // Downtime should never be indexed as the state of the product.
  robots: { index: false, follow: false },
};

// No database call anywhere on this page, on purpose — it is the page that has
// to render precisely when Postgres cannot be reached.
export default function MaintenancePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4 py-10 text-ink">
      <section className="glass-panel w-full max-w-lg rounded-[28px] p-7 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-warning-soft text-warning">
          <Wrench size={21} />
        </div>

        <h1 className="mt-5 font-serif text-3xl font-semibold tracking-tight">
          Beauty OS is temporarily unavailable
        </h1>

        <p className="mt-3 text-sm leading-6 text-muted">
          We have hit a capacity limit with our database provider, so the app cannot load your workspace right now.
          This is our problem to fix, not something you did, and we are sorry for the disruption to your day.
        </p>

        <div className="mt-6 grid gap-3 text-left">
          <div className="flex items-start gap-3 rounded-2xl border border-line bg-card p-4">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-success" />
            <div>
              <div className="text-[14px] font-semibold text-ink">Your data is safe</div>
              <p className="mt-0.5 text-[13px] leading-6 text-muted">
                Nothing has been deleted or lost. Every client, booking and payment is exactly where you left it and
                will be there when the app comes back.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-line bg-card p-4">
            <Clock size={18} className="mt-0.5 shrink-0 text-plum" />
            <div>
              <div className="text-[14px] font-semibold text-ink">Expected back: {EXPECTED_BACK}</div>
              <p className="mt-0.5 text-[13px] leading-6 text-muted">
                Our database allowance resets then and service resumes automatically. If we restore things sooner we
                will let you know by email.
              </p>
            </div>
          </div>
        </div>

        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Beauty OS downtime")}`}
          className="primary-action mt-6 inline-flex w-full items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold text-white"
        >
          Contact us
        </a>

        <p className="mt-4 text-[11.5px] leading-5 text-faint">
          If you need something urgently for a client today, email us and we will help however we can.
        </p>
      </section>
    </main>
  );
}
