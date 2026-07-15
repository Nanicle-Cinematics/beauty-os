import Link from "next/link";
import { getInvite } from "@/lib/onboarding-data";
import { acceptInviteAction } from "@/lib/onboarding-actions";
import { PasswordInput } from "@/components/password-input";

export const dynamic = "force-dynamic";

type InvitePageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
};

const inputClass = "h-12 rounded-xl border border-line bg-sunken px-4 text-ink outline-none focus:border-plum";
const labelClass = "grid gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted";

export default async function InvitePage({ params, searchParams }: InvitePageProps) {
  const { token } = await params;
  const { error } = await searchParams;
  const invite = await getInvite(token);

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4 py-10 text-ink">
      <div className="w-full max-w-md">
        <div className="mb-5 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-plum">Beauty OS</div>
          <h1 className="mt-1 font-serif text-2xl font-semibold tracking-tight">Set up your account</h1>
        </div>

        {!invite ? (
          <div className="grid gap-4 rounded-[24px] border border-line bg-card p-6 text-center shadow-[var(--shadow-soft)]">
            <p className="text-sm text-muted">
              This invite link is invalid or has expired. Ask your Beauty OS admin to send a fresh one.
            </p>
            <Link href="/login" className="rounded-xl border border-line px-4 py-3 text-sm font-medium hover:bg-sunken">
              Go to sign in
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 rounded-[24px] border border-line bg-card p-6 shadow-[var(--shadow-soft)]">
            <p className="text-sm text-muted">
              You&rsquo;re joining <span className="font-semibold text-ink">{invite.businessName}</span> as the owner.
              Sign-in email: <span className="font-semibold text-ink">{invite.email}</span>
            </p>

            {error ? (
              <div className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
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
              <button className="mt-1 rounded-xl bg-gradient-to-r from-plum to-wine px-6 py-3 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(84,33,63,0.28)]">
                Activate account
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
