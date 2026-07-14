import Link from "next/link";
import { signUpAction } from "@/lib/signup-actions";
import { getSignupCategories } from "@/lib/signup-data";
import { PasswordInput } from "@/components/password-input";

export const dynamic = "force-dynamic";

type SignupPageProps = {
  searchParams: Promise<{ error?: string }>;
};

const inputClass = "h-12 rounded-2xl border border-[#dbe4de] bg-[#f8faf8] px-4 outline-none focus:border-[#1d7b5d]";
const labelClass = "grid gap-1.5 text-xs font-black uppercase tracking-[0.12em] text-[#6b7c73]";

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { error } = await searchParams;
  const categories = await getSignupCategories();

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f8f6] px-6 py-8 text-[#111b17] max-[720px]:px-3">
      <section className="grid w-full max-w-5xl grid-cols-[420px_minmax(0,1fr)] overflow-hidden rounded-[32px] border border-[#dbe4de] bg-white shadow-[0_24px_60px_rgba(16,38,31,0.12)] max-[900px]:grid-cols-1">
        <div className="bg-[#10261f] p-8 text-white max-[720px]:p-5">
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-[#f2c66d] text-lg font-black text-[#10261f]">BO</span>
            <span>
              <span className="block text-sm font-black">Beauty OS</span>
              <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-white/50">Start free</span>
            </span>
          </Link>
          <h1 className="mt-8 text-3xl font-black leading-tight tracking-tight">Run your studio on one calm system.</h1>
          <p className="mt-4 text-sm leading-6 text-white/72">
            Bookings, clients, staff, inventory, payments and marketing — set up in a minute, free while you trial.
          </p>
          <div className="mt-8 grid gap-2 text-sm font-bold text-white/82">
            <div className="rounded-2xl bg-white/10 p-3">No card required to start</div>
            <div className="rounded-2xl bg-white/10 p-3">Your own secure workspace</div>
            <div className="rounded-2xl bg-white/10 p-3">You&rsquo;re the owner from minute one</div>
          </div>
        </div>

        <div className="p-8 max-[720px]:p-5">
          <h2 className="text-xl font-black tracking-tight">Create your workspace</h2>
          <p className="mt-1 text-sm text-[#6b7c73]">
            Already have an account?{" "}
            <Link href="/login" className="font-black text-[#1d7b5d]">Sign in</Link>
          </p>

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
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
            <button className="mt-2 rounded-2xl bg-[#10261f] px-6 py-3 text-sm font-black text-white">
              Start free trial
            </button>
            <p className="text-center text-xs font-semibold text-[#8a978f]">
              By continuing you agree to run this workspace responsibly.
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}
