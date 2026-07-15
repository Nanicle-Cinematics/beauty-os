import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getAccount } from "@/lib/settings-data";
import { updateProfileAction, changePasswordAction } from "@/lib/settings-actions";
import { PasswordInput } from "@/components/password-input";

export const dynamic = "force-dynamic";

type SettingsPageProps = {
  searchParams: Promise<{ updated?: string; error?: string }>;
};

const inputClass = "h-12 w-full rounded-2xl border border-[#e9dee5] bg-[#f7f2f5] px-4 outline-none focus:border-[#6d315f]";
const labelClass = "grid gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#796e77]";
const cardClass = "grid gap-4 card p-5";

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const user = await requireUser("/settings");
  const [{ updated, error }, account] = await Promise.all([searchParams, getAccount(user.id)]);
  const name = account?.name ?? user.name;
  const phone = account?.phone ?? "";
  const email = account?.email ?? user.email;

  return (
    <main className="min-h-screen bg-[#fbf7f4] px-6 py-6 text-[#231c22] max-[720px]:px-3">
      <div className="mx-auto grid max-w-2xl gap-5">
        <header className="card flex items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3.5">
            <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-plum to-wine font-serif text-lg font-semibold text-white shadow-[0_6px_18px_rgba(84,33,63,0.4)]">B</span>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-plum">Account</div>
              <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/app" className="rounded-xl border border-line px-4 py-2 text-sm font-medium hover:bg-sunken">Workspaces</Link>
            <Link href="/logout" className="rounded-xl border border-line px-4 py-2 text-sm font-medium hover:bg-sunken">Sign out</Link>
          </div>
        </header>

        {updated ? (
          <div className="rounded-2xl border border-[#e9dee5] bg-[#f6edf2] px-4 py-3 text-sm font-bold text-[#6d315f]">
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
            <p className="mt-1 text-sm text-[#796e77]">
              Signed in as <span className="font-semibold text-[#231c22]">{email}</span>
              {account?.verified ? (
                <span className="ml-2 rounded-full bg-[#f6edf2] px-2 py-0.5 text-[11px] font-semibold text-[#6d315f]">Verified</span>
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
            <button className="mt-1 w-fit rounded-2xl bg-gradient-to-r from-plum to-wine px-6 py-3 text-sm font-semibold text-white">Save profile</button>
          </form>
        </section>

        {/* Password */}
        <section className={cardClass}>
          <div>
            <h2 className="text-lg font-semibold">Password</h2>
            <p className="mt-1 text-sm text-[#796e77]">Use a strong password you don&rsquo;t reuse elsewhere.</p>
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
            <button className="mt-1 w-fit rounded-2xl bg-gradient-to-r from-plum to-wine px-6 py-3 text-sm font-semibold text-white">Change password</button>
          </form>
        </section>
      </div>
    </main>
  );
}
