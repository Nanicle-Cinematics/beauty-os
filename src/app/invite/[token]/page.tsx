import Link from "next/link";
import { getInvite } from "@/lib/onboarding-data";
import { acceptInviteAction } from "@/lib/onboarding-actions";
import { PasswordInput } from "@/components/password-input";

export const dynamic = "force-dynamic";

type InvitePageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
};

const inputClass = "h-12 rounded-2xl border border-[#e7e7ea] bg-[#f7f7f8] px-4 outline-none focus:border-[#9d4e7a]";
const labelClass = "grid gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#71717a]";

export default async function InvitePage({ params, searchParams }: InvitePageProps) {
  const { token } = await params;
  const { error } = await searchParams;
  const invite = await getInvite(token);

  return (
    <main className="grid min-h-screen place-items-center bg-[#fafafa] px-4 py-10 text-[#18181b]">
      <div className="w-full max-w-md">
        <div className="mb-5 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9d4e7a]">Beauty OS</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Set up your account</h1>
        </div>

        {!invite ? (
          <div className="grid gap-4 rounded-[28px] border border-[#e7e7ea] bg-white p-6 text-center shadow-[0_18px_45px_rgba(24,24,27,0.08)]">
            <p className="text-sm font-bold text-[#71717a]">
              This invite link is invalid or has expired. Ask your Beauty OS admin to send a fresh one.
            </p>
            <Link href="/login" className="rounded-2xl border border-[#e7e7ea] px-4 py-3 text-sm font-semibold">
              Go to sign in
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 rounded-[28px] border border-[#e7e7ea] bg-white p-6 shadow-[0_18px_45px_rgba(24,24,27,0.08)]">
            <p className="text-sm font-semibold text-[#71717a]">
              You&rsquo;re joining <span className="font-semibold text-[#18181b]">{invite.businessName}</span> as the owner.
              Sign-in email: <span className="font-semibold text-[#18181b]">{invite.email}</span>
            </p>

            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                {error}
              </div>
            ) : null}

            <form action={acceptInviteAction} className="grid gap-3">
              <input type="hidden" name="token" value={token} />
              <label className={labelClass}>
                Your name
                <input name="name" defaultValue={invite.name} className={inputClass} required />
              </label>
              <label className={labelClass}>
                Create a password (min 8 characters)
                <PasswordInput name="password" minLength={8} placeholder="Choose a strong password" autoComplete="new-password" className={`${inputClass} w-full`} required />
              </label>
              <button className="mt-1 rounded-2xl bg-[#18181b] px-6 py-3 text-sm font-semibold text-white">
                Activate account
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
