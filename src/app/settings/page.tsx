import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getAccount } from "@/lib/settings-data";
import { updateProfileAction, changePasswordAction } from "@/lib/settings-actions";
import { PasswordInput } from "@/components/password-input";

export const dynamic = "force-dynamic";

type SettingsPageProps = {
  searchParams: Promise<{ updated?: string; error?: string }>;
};

const inputClass = "h-12 w-full rounded-2xl border border-[#e7e7ea] bg-[#f7f7f8] px-4 outline-none focus:border-[#9d4e7a]";
const labelClass = "grid gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#71717a]";
const cardClass = "grid gap-4 rounded-[24px] border border-[#e7e7ea] bg-white p-5 shadow-[0_12px_35px_rgba(24,24,27,0.06)]";

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const user = await requireUser("/settings");
  const [{ updated, error }, account] = await Promise.all([searchParams, getAccount(user.id)]);
  const name = account?.name ?? user.name;
  const phone = account?.phone ?? "";
  const email = account?.email ?? user.email;

  return (
    <main className="min-h-screen bg-[#fafafa] px-6 py-6 text-[#18181b] max-[720px]:px-3">
      <div className="mx-auto grid max-w-2xl gap-5">
        <header className="flex items-center justify-between gap-4 rounded-3xl border border-[#e7e7ea] bg-white px-5 py-4 shadow-[0_18px_45px_rgba(24,24,27,0.08)]">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9d4e7a]">Account</div>
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/app" className="rounded-2xl border border-[#e7e7ea] px-4 py-2 text-sm font-semibold">Workspaces</Link>
            <Link href="/logout" className="rounded-2xl border border-[#e7e7ea] px-4 py-2 text-sm font-semibold">Sign out</Link>
          </div>
        </header>

        {updated ? (
          <div className="rounded-2xl border border-[#efd6e4] bg-[#faf1f6] px-4 py-3 text-sm font-bold text-[#9d4e7a]">
            {updated === "password" ? "Password changed." : "Profile updated."}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>
        ) : null}

        {/* Profile */}
        <section className={cardClass}>
          <div>
            <h2 className="text-lg font-semibold">Profile</h2>
            <p className="mt-1 text-sm text-[#71717a]">
              Signed in as <span className="font-semibold text-[#18181b]">{email}</span>
              {account?.verified ? (
                <span className="ml-2 rounded-full bg-[#faf1f6] px-2 py-0.5 text-[11px] font-semibold text-[#9d4e7a]">Verified</span>
              ) : null}
            </p>
          </div>
          <form action={updateProfileAction} className="grid gap-3">
            <label className={labelClass}>
              Name
              <input name="name" defaultValue={name} className={inputClass} required />
            </label>
            <label className={labelClass}>
              Phone (optional)
              <input name="phone" defaultValue={phone} placeholder="+233 …" className={inputClass} />
            </label>
            <button className="mt-1 w-fit rounded-2xl bg-[#18181b] px-6 py-3 text-sm font-semibold text-white">Save profile</button>
          </form>
        </section>

        {/* Password */}
        <section className={cardClass}>
          <div>
            <h2 className="text-lg font-semibold">Password</h2>
            <p className="mt-1 text-sm text-[#71717a]">Use a strong password you don&rsquo;t reuse elsewhere.</p>
          </div>
          <form action={changePasswordAction} className="grid gap-3">
            <label className={labelClass}>
              Current password
              <PasswordInput name="currentPassword" autoComplete="current-password" className={inputClass} required />
            </label>
            <div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
              <label className={labelClass}>
                New password (min 8)
                <PasswordInput name="newPassword" minLength={8} autoComplete="new-password" className={inputClass} required />
              </label>
              <label className={labelClass}>
                Confirm new password
                <PasswordInput name="confirmPassword" minLength={8} autoComplete="new-password" className={inputClass} required />
              </label>
            </div>
            <button className="mt-1 w-fit rounded-2xl bg-[#18181b] px-6 py-3 text-sm font-semibold text-white">Change password</button>
          </form>
        </section>
      </div>
    </main>
  );
}
