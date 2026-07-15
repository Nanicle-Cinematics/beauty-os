import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { loginAction } from "@/lib/auth-actions";
import { getCurrentUser } from "@/lib/auth";
import { PasswordInput } from "@/components/password-input";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
    error?: string;
  }>;
};

function safeNextPath(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/app";
  }

  return value;
}

const inputClass =
  "h-12 rounded-xl border border-line bg-sunken px-4 text-ink outline-none focus:border-plum";

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [{ next, error }, user] = await Promise.all([searchParams, getCurrentUser()]);
  const nextPath = safeNextPath(next);

  if (user) {
    redirect(nextPath);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-6 py-8 text-ink max-[720px]:px-3">
      <section className="grid w-full max-w-5xl grid-cols-[minmax(0,1fr)_420px] overflow-hidden rounded-[28px] border border-line bg-card shadow-[var(--shadow-lift)] max-[900px]:grid-cols-1">
        <div className="brand-dark relative overflow-hidden p-8 max-[720px]:p-5">
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-plum to-wine font-serif text-lg font-semibold text-white shadow-[0_6px_18px_rgba(84,33,63,0.4)]">
              B
            </span>
            <span>
              <span className="block font-serif text-base font-semibold">Beauty OS</span>
              <span className="block text-[11px] font-medium uppercase tracking-[0.18em] text-white/50">
                Secure access
              </span>
            </span>
          </Link>

          <div className="mt-12 max-w-md">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-rose">
              <Sparkles size={12} /> Multi-tenant login
            </div>
            <h1 className="font-serif text-4xl font-semibold leading-tight tracking-tight max-[720px]:text-3xl">
              Sign in once, then work inside the right business.
            </h1>
            <p className="mt-4 text-sm leading-6 text-white/70">
              Platform admins can manage every tenant. Business owners and staff only see the workspaces they belong to.
            </p>
          </div>

          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-sm text-white/70">
            New to Beauty OS?{" "}
            <Link href="/signup" className="font-semibold text-rose">Start a free trial</Link> and get your own workspace in a minute.
          </div>
        </div>

        <form action={loginAction} className="grid content-center gap-4 p-8 max-[720px]:p-5">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Sign in to your workspace, or{" "}
              <Link href="/signup" className="font-semibold text-plum">create a new one</Link>.
            </p>
          </div>

          {error === "invalid" ? (
            <div className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
              Email or password is incorrect.
            </div>
          ) : null}

          <input type="hidden" name="next" value={nextPath} />

          <label className="grid gap-2 text-sm font-semibold">
            Email
            <input
              name="email"
              type="email"
              placeholder="you@studio.com"
              className={inputClass}
              required
            />
          </label>

          <label className="grid gap-2 text-sm font-semibold">
            Password
            <PasswordInput
              name="password"
              placeholder="Your password"
              autoComplete="current-password"
              className={`${inputClass} w-full`}
              required
            />
          </label>

          <button className="mt-2 rounded-xl bg-gradient-to-r from-plum to-wine px-4 py-3 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(84,33,63,0.28)]">
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
