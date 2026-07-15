import Link from "next/link";
import { redirect } from "next/navigation";
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

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [{ next, error }, user] = await Promise.all([searchParams, getCurrentUser()]);
  const nextPath = safeNextPath(next);

  if (user) {
    redirect(nextPath);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#fafafa] px-6 py-8 text-[#18181b] max-[720px]:px-3">
      <section className="grid w-full max-w-5xl grid-cols-[minmax(0,1fr)_420px] overflow-hidden rounded-[32px] border border-[#e7e7ea] bg-white shadow-[0_24px_60px_rgba(24,24,27,0.12)] max-[900px]:grid-cols-1">
        <div className="bg-[#18181b] p-8 text-white max-[720px]:p-5">
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-[#9d4e7a] text-lg font-semibold text-white">
              BO
            </span>
            <span>
              <span className="block text-sm font-semibold">Beauty OS</span>
              <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-white/50">
                Secure access
              </span>
            </span>
          </Link>

          <div className="mt-12 max-w-md">
            <div className="mb-4 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9d4e7a]">
              Multi-tenant login
            </div>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight max-[720px]:text-3xl">
              Sign in once, then work inside the right business.
            </h1>
            <p className="mt-4 text-sm leading-6 text-white/72">
              Platform admins can manage every tenant. Business owners and staff only see the workspaces they belong to.
            </p>
          </div>

          <div className="mt-10 rounded-2xl border border-white/10 bg-white/8 p-4 text-sm text-white/72">
            New to Beauty OS?{" "}
            <Link href="/signup" className="font-semibold text-[#9d4e7a]">Start a free trial</Link> and get your own workspace in a minute.
          </div>
        </div>

        <form action={loginAction} className="grid content-center gap-4 p-8 max-[720px]:p-5">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
            <p className="mt-2 text-sm leading-6 text-[#71717a]">
              Sign in to your workspace, or{" "}
              <Link href="/signup" className="font-semibold text-[#9d4e7a]">create a new one</Link>.
            </p>
          </div>

          {error === "invalid" ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
              Email or password is incorrect.
            </div>
          ) : null}

          <input type="hidden" name="next" value={nextPath} />

          <label className="grid gap-2 text-sm font-bold">
            Email
            <input
              name="email"
              type="email"
              placeholder="you@studio.com"
              className="h-12 rounded-2xl border border-[#e7e7ea] bg-[#f7f7f8] px-4 outline-none focus:border-[#9d4e7a]"
              required
            />
          </label>

          <label className="grid gap-2 text-sm font-bold">
            Password
            <PasswordInput
              name="password"
              placeholder="Your password"
              autoComplete="current-password"
              className="h-12 w-full rounded-2xl border border-[#e7e7ea] bg-[#f7f7f8] px-4 outline-none focus:border-[#9d4e7a]"
              required
            />
          </label>

          <button className="mt-2 rounded-2xl bg-[#18181b] px-4 py-3 text-sm font-semibold text-white">
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
