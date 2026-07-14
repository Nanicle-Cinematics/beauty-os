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
    <main className="grid min-h-screen place-items-center bg-[#f6f8f6] px-4 py-10 text-[#111b17]">
      <div className="w-full max-w-md">
        <div className="mb-5 text-center">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#1d7b5d]">Beauty OS</div>
          <h1 className="mt-1 text-2xl font-black tracking-tight">One quick step</h1>
        </div>

        <div className="grid gap-4 rounded-[28px] border border-[#dbe4de] bg-white p-6 text-center shadow-[0_18px_45px_rgba(16,38,31,0.08)]">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-amber-50 text-lg font-black text-amber-700">✉</div>
          <p className="text-sm font-semibold text-[#6b7c73]">
            {verify === "sent" ? (
              <>A fresh verification link is on its way to <span className="font-black text-[#111b17]">{user.email}</span>.</>
            ) : (
              <>Verify your email to start using Beauty OS. We sent a link to <span className="font-black text-[#111b17]">{user.email}</span> — open it to continue.</>
            )}
          </p>
          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700">{error}</div>
          ) : null}
          <p className="text-xs font-semibold text-[#8a978f]">Already clicked it? Refresh this page.</p>

          <div className="mt-1 grid gap-2">
            <form action={resendVerificationAction}>
              <button className="w-full rounded-2xl bg-[#10261f] px-4 py-3 text-sm font-black text-white">
                Resend the link
              </button>
            </form>
            <Link href="/logout" className="rounded-2xl border border-[#dbe4de] px-4 py-3 text-sm font-black">
              Sign out
            </Link>
          </div>
        </div>

        <p className="mt-4 text-center text-xs font-semibold text-[#8a978f]">
          Check your spam folder if you don&rsquo;t see it within a minute.
        </p>
      </div>
    </main>
  );
}
