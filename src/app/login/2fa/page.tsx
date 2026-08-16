import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { verifyMfaAction } from "@/lib/auth-actions";
import { verifyChallenge } from "@/lib/mfa";
import { mfaChallengeCookieName } from "@/lib/auth";
import { normalizeInternalPath } from "@/lib/redirects";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ next?: string; error?: string }> };

export default async function TwoFactorLoginPage({ searchParams }: Props) {
  const { next, error } = await searchParams;
  const store = await cookies();
  const userId = verifyChallenge(store.get(mfaChallengeCookieName)?.value);
  if (!userId) {
    // No valid challenge — send them back to sign in.
    redirect("/login");
  }
  const nextPath = normalizeInternalPath(next);

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4 py-10 text-ink">
      <div className="w-full max-w-md">
        <div className="mb-5 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-plum">Beauty OS</div>
          <h1 className="mt-1 font-serif text-2xl font-semibold tracking-tight">Two-step verification</h1>
        </div>

        <form action={verifyMfaAction} className="grid gap-4 rounded-[24px] border border-line bg-card p-6 shadow-[var(--shadow-soft)]">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-plum-soft text-plum">
            <ShieldCheck size={22} />
          </div>
          <p className="text-center text-sm text-muted">
            Enter the 6-digit code from your authenticator app — or a recovery code.
          </p>
          {error ? (
            <div className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-2 text-center text-xs font-semibold text-danger">
              That code didn&apos;t match. Try again.
            </div>
          ) : null}

          <input type="hidden" name="next" value={nextPath} />
          <input
            name="code"
            inputMode="text"
            autoComplete="one-time-code"
            autoFocus
            placeholder="123456"
            className="input text-center tracking-[0.3em]"
            required
          />
          <button className="rounded-xl bg-gradient-to-r from-plum to-wine px-4 py-3 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(84,33,63,0.28)]">
            Verify
          </button>
          <Link href="/login" className="text-center text-xs font-medium text-muted hover:text-plum">
            Back to sign in
          </Link>
        </form>
      </div>
    </main>
  );
}
