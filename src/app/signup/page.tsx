import Link from "next/link";
import { Check } from "lucide-react";
import { signUpAction } from "@/lib/signup-actions";
import { getSignupCategories } from "@/lib/signup-data";
import { PasswordInput } from "@/components/password-input";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";

type SignupPageProps = {
  searchParams: Promise<{ error?: string }>;
};

const inputClass = "h-12 rounded-xl border border-line bg-sunken px-4 text-ink outline-none focus:border-plum";
const labelClass = "grid gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted";
const perks = ["No card required to start", "Your own secure workspace", "You're the owner from minute one"];

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { error } = await searchParams;
  const categories = await getSignupCategories();

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-6 py-8 text-ink max-[720px]:px-3">
      <section className="grid w-full max-w-5xl grid-cols-[420px_minmax(0,1fr)] overflow-hidden rounded-[28px] border border-line bg-card shadow-[var(--shadow-lift)] max-[900px]:grid-cols-1">
        <div className="brand-dark relative overflow-hidden p-8 max-[720px]:p-5">
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-plum to-wine font-serif text-lg font-semibold text-white shadow-[0_6px_18px_rgba(84,33,63,0.4)]">B</span>
            <span>
              <span className="block font-serif text-base font-semibold">Beauty OS</span>
              <span className="block text-[11px] font-medium uppercase tracking-[0.18em] text-white/50">Start free</span>
            </span>
          </Link>
          <h1 className="mt-8 font-serif text-3xl font-semibold leading-tight tracking-tight">Run your studio on one calm system.</h1>
          <p className="mt-4 text-sm leading-6 text-white/70">
            Bookings, clients, staff, inventory, payments and marketing — set up in a minute, free while you trial.
          </p>
          <div className="mt-8 grid gap-2 text-sm font-medium text-white/85">
            {perks.map((perk) => (
              <div key={perk} className="flex items-center gap-2.5 rounded-xl bg-white/[0.07] px-3 py-2.5">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white/15 text-rose">
                  <Check size={12} strokeWidth={3} />
                </span>
                {perk}
              </div>
            ))}
          </div>
        </div>

        <div className="p-8 max-[720px]:p-5">
          <h2 className="text-xl font-semibold tracking-tight">Create your workspace</h2>
          <p className="mt-1 text-sm text-muted">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-plum">Sign in</Link>
          </p>

          {error ? (
            <div className="mt-4 rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
              {error}
            </div>
          ) : null}

          <form action={signUpAction} className="mt-5 grid gap-3">
            <label className={labelClass}>
              Business name
              <input name="businessName" placeholder="e.g. Accra Glow Studio" className={inputClass} required />
            </label>
            <label className={labelClass}>
              What do you do?
              <select name="categoryId" defaultValue="" className={inputClass} required>
                <option value="" disabled>Select your business type</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
              <label className={labelClass}>
                Your name
                <input name="ownerName" placeholder="Full name" className={inputClass} required />
              </label>
              <label className={labelClass}>
                Email
                <input name="ownerEmail" type="email" placeholder="you@studio.com" className={inputClass} required />
              </label>
            </div>
            <label className={labelClass}>
              Password (min 8 characters)
              <PasswordInput name="ownerPassword" minLength={8} placeholder="Create a password" autoComplete="new-password" className={`${inputClass} w-full`} required />
            </label>
            <SubmitButton className="mt-2 rounded-xl bg-gradient-to-r from-plum to-wine px-6 py-3 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(84,33,63,0.28)]" pendingText="Creating your workspace…">
              Start free trial
            </SubmitButton>
            <p className="text-center text-xs font-medium text-faint">
              By continuing you agree to run this workspace responsibly.
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}
