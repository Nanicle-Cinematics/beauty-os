import Link from "next/link";
import { redirect } from "next/navigation";
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
    <main className="grid min-h-screen place-items-center bg-[#fafafa] px-4 py-10 text-[#18181b]">
      <div className="w-full max-w-md">
        <div className="mb-5 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6d5cf5]">Beauty OS</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">One quick step</h1>
        </div>

        <div className="grid gap-4 rounded-[28px] border border-[#e7e7ea] bg-white p-6 text-center shadow-[0_18px_45px_rgba(24,24,27,0.08)]">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-amber-50 text-lg font-semibold text-amber-700">✉</div>
          <p className="text-sm font-semibold text-[#71717a]">
            {verify === "sent" ? (
              <>A fresh verification link is on its way to <span className="font-semibold text-[#18181b]">{user.email}</span>.</>
            ) : (
              <>Verify your email to start using Beauty OS. We sent a link to <span className="font-semibold text-[#18181b]">{user.email}</span> — open it to continue.</>
            )}
          </p>
          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700">{error}</div>
          ) : null}
          <p className="text-xs font-semibold text-[#a1a1aa]">Already clicked it? Refresh this page.</p>

          <div className="mt-1 grid gap-2">
            <form action={resendVerificationAction}>
              <button className="w-full rounded-2xl bg-[#18181b] px-4 py-3 text-sm font-semibold text-white">
                Resend the link
              </button>
            </form>
            <Link href="/logout" className="rounded-2xl border border-[#e7e7ea] px-4 py-3 text-sm font-semibold">
              Sign out
            </Link>
          </div>
        </div>

        <p className="mt-4 text-center text-xs font-semibold text-[#a1a1aa]">
          Check your spam folder if you don&rsquo;t see it within a minute.
        </p>
      </div>
    </main>
  );
}
