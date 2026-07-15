import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { resendVerificationAction } from "@/lib/verification-actions";

export const dynamic = "force-dynamic";

type VerifyEmailPageProps = {
  searchParams: Promise<{ verify?: string; error?: string }>;
};

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const user = await requireSession("/verify-email");
  if (user.verified) {
    redirect("/app");
  }
  const { verify, error } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4 py-10 text-ink">
      <div className="w-full max-w-md">
        <div className="mb-5 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-plum">Beauty OS</div>
          <h1 className="mt-1 font-serif text-2xl font-semibold tracking-tight">One quick step</h1>
        </div>

        <div className="grid gap-4 rounded-[24px] border border-line bg-card p-6 text-center shadow-[var(--shadow-soft)]">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-warning-soft text-warning">
            <Mail size={22} />
          </div>
          <p className="text-sm text-muted">
            {verify === "sent" ? (
              <>A fresh verification link is on its way to <span className="font-semibold text-ink">{user.email}</span>.</>
            ) : (
              <>Verify your email to start using Beauty OS. We sent a link to <span className="font-semibold text-ink">{user.email}</span> — open it to continue.</>
            )}
          </p>
          {error ? (
            <div className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-2 text-xs font-semibold text-danger">{error}</div>
          ) : null}
          <p className="text-xs font-medium text-faint">Already clicked it? Refresh this page.</p>

          <div className="mt-1 grid gap-2">
            <form action={resendVerificationAction}>
              <button className="w-full rounded-xl bg-gradient-to-r from-plum to-wine px-4 py-3 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(84,33,63,0.28)]">
                Resend the link
              </button>
            </form>
            <Link href="/logout" prefetch={false} className="rounded-xl border border-line px-4 py-3 text-sm font-medium hover:bg-sunken">
              Sign out
            </Link>
          </div>
        </div>

        <p className="mt-4 text-center text-xs font-medium text-faint">
          Check your spam folder if you don&rsquo;t see it within a minute.
        </p>
      </div>
    </main>
  );
}
