import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getAccount } from "@/lib/settings-data";
import { updateProfileAction, changePasswordAction } from "@/lib/settings-actions";
import { getMfaStatus, getPendingEnrollment } from "@/lib/mfa-data";
import { getOwnedWorkspaces } from "@/lib/account-data";
import { PasswordInput } from "@/components/password-input";
import { TwoFactor } from "@/components/two-factor";
import { DangerZone } from "@/components/danger-zone";
import { themeOptions } from "@/lib/theme";

export const dynamic = "force-dynamic";

type SettingsPageProps = {
  searchParams: Promise<{ updated?: string; error?: string }>;
};

const inputClass = "h-12 w-full rounded-2xl border border-line bg-sunken px-4 outline-none focus:border-plum";
const labelClass = "grid gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted";
const cardClass = "grid gap-4 card p-5";

function initials(name: string, email: string) {
  return (name || email)
    .split(/\s+|@/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const user = await requireUser("/settings");
  const [{ updated, error }, account, mfaStatus, mfaEnrollment, ownedWorkspaces] = await Promise.all([
    searchParams,
    getAccount(user.id),
    getMfaStatus(user.id),
    getPendingEnrollment(user.id, user.email),
    getOwnedWorkspaces(user.id),
  ]);
  const name = account?.name ?? user.name;
  const phone = account?.phone ?? "";
  const email = account?.email ?? user.email;
  const avatarUrl = account?.avatarUrl ?? user.avatarUrl ?? "";
  const themePreference = account?.themePreference ?? user.themePreference;

  return (
    <main data-theme={themePreference} className="min-h-screen px-6 py-6 text-ink max-[720px]:px-3">
      <div className="mx-auto grid max-w-2xl gap-5">
        <header className="card flex items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3.5">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="size-12 rounded-2xl object-cover shadow-[var(--shadow-soft)]" />
            ) : (
              <span className="primary-action grid size-12 place-items-center rounded-2xl font-serif text-lg font-semibold text-white">
                {initials(name, email)}
              </span>
            )}
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-plum">Account</div>
              <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/app" className="rounded-xl border border-line px-4 py-2 text-sm font-medium hover:bg-sunken">Workspaces</Link>
            <Link href="/logout" prefetch={false} className="rounded-xl border border-line px-4 py-2 text-sm font-medium hover:bg-sunken">Sign out</Link>
          </div>
        </header>

        {updated ? (
          <div className="rounded-2xl border border-line bg-plum-soft px-4 py-3 text-sm font-bold text-plum">
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
            <p className="mt-1 text-sm text-muted">
              Signed in as <span className="font-semibold text-ink">{email}</span>
              {account?.verified ? (
                <span className="ml-2 rounded-full bg-plum-soft px-2 py-0.5 text-[11px] font-semibold text-plum">Verified</span>
              ) : null}
            </p>
          </div>
          <form action={updateProfileAction} encType="multipart/form-data" className="grid gap-4">
            <input type="hidden" name="currentAvatarUrl" value={avatarUrl} />
            <div className="flex items-center gap-4 rounded-[24px] border border-white/55 bg-white/35 p-4">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="size-20 rounded-[28px] object-cover shadow-[var(--shadow-soft)]" />
              ) : (
                <span className="grid size-20 place-items-center rounded-[28px] bg-plum-soft text-xl font-bold text-plum">
                  {initials(name, email)}
                </span>
              )}
              <div className="min-w-0">
                <div className="text-sm font-semibold text-ink">Profile picture</div>
                <p className="mt-1 text-xs leading-5 text-muted">Upload a square image under 750KB, or paste an image URL.</p>
              </div>
            </div>
            <label className={labelClass}>
              Name
              <input name="name" defaultValue={name} className={inputClass} required />
            </label>
            <label className={labelClass}>
              Phone (optional)
              <input name="phone" defaultValue={phone} placeholder="+233 …" className={inputClass} />
            </label>
            <div className="grid grid-cols-2 gap-3 max-[620px]:grid-cols-1">
              <label className={labelClass}>
                Image URL
                <input name="avatarUrl" defaultValue={avatarUrl.startsWith("data:image/") ? "" : avatarUrl} placeholder="https://…" className={inputClass} />
              </label>
              <label className={labelClass}>
                Upload image
                <input name="avatarFile" type="file" accept="image/*" className="block h-12 w-full rounded-2xl border border-line bg-sunken px-4 py-2.5 text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-plum-soft file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-plum" />
              </label>
            </div>
            {avatarUrl ? (
              <label className="flex items-center gap-2 text-sm font-semibold text-muted">
                <input type="checkbox" name="removeAvatar" value="true" className="size-4 accent-plum" />
                Remove current profile picture
              </label>
            ) : null}

            <div className="grid gap-2">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Theme</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {themeOptions.map((theme) => (
                  <label
                    key={theme.key}
                    data-theme={theme.key}
                    className="glass-panel flex cursor-pointer gap-3 rounded-[22px] p-3 ring-plum transition has-[:checked]:ring-2"
                  >
                    <input type="radio" name="themePreference" value={theme.key} defaultChecked={themePreference === theme.key} className="mt-1 size-4 shrink-0 accent-plum" />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">{theme.label}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-muted">{theme.description}</span>
                      <span className="mt-2 flex gap-1.5">
                        <span className="size-4 rounded-full bg-plum" />
                        <span className="size-4 rounded-full bg-rose" />
                        <span className="size-4 rounded-full bg-aqua" />
                        <span className="size-4 rounded-full bg-mint" />
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <button className="primary-action mt-1 w-fit rounded-2xl px-6 py-3 text-sm font-semibold text-white">Save profile</button>
          </form>
        </section>

        {/* Password */}
        <section className={cardClass}>
          <div>
            <h2 className="text-lg font-semibold">Password</h2>
            <p className="mt-1 text-sm text-muted">Use a strong password you don&rsquo;t reuse elsewhere.</p>
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
            <button className="primary-action mt-1 w-fit rounded-2xl px-6 py-3 text-sm font-semibold text-white">Change password</button>
          </form>
        </section>

        {/* Two-factor authentication */}
        <TwoFactor status={mfaStatus} enrollment={mfaEnrollment} />

        {/* Danger zone — self-service deletion */}
        <DangerZone ownedWorkspaces={ownedWorkspaces} />
      </div>
    </main>
  );
}
