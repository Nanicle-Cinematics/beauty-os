import Link from "next/link";
import { getPlatformOverview } from "@/lib/platform-data";
import {
  setBusinessStatusAction,
  changeBusinessPlanAction,
  resendInviteAction,
  revokeInviteAction,
  deleteBusinessAction,
} from "@/lib/platform-actions";
import { requirePlatformAdmin } from "@/lib/auth";
import { getBaseUrl, inviteUrl as buildInviteUrl } from "@/lib/urls";
import { DeleteBusinessButton } from "@/components/delete-business-button";

export const dynamic = "force-dynamic";

const statusPill: Record<string, string> = {
  ACTIVE: "bg-[#faf1f6] text-[#9d4e7a]",
  TRIAL: "bg-amber-50 text-amber-700",
  SUSPENDED: "bg-rose-50 text-rose-700",
  CLOSED: "bg-[#f2f2f4] text-[#71717a]",
};

const subPill: Record<string, string> = {
  ACTIVE: "bg-[#faf1f6] text-[#9d4e7a]",
  TRIALING: "bg-amber-50 text-amber-700",
  PAST_DUE: "bg-rose-50 text-rose-700",
  CANCELED: "bg-[#f2f2f4] text-[#71717a]",
};

const inviteStateLabel: Record<string, string> = {
  active: "Invite sent",
  revoked: "Revoked",
  expired: "Expired",
  none: "No invite",
};

const inputClass = "h-11 rounded-2xl border border-[#e7e7ea] bg-[#f7f7f8] px-3 text-sm outline-none focus:border-[#9d4e7a]";
const cardClass = "rounded-[24px] border border-[#e7e7ea] bg-white p-5 shadow-[0_12px_35px_rgba(24,24,27,0.06)]";

type PlatformPageProps = {
  searchParams: Promise<{
    created?: string;
    invite?: string;
    slug?: string;
    resent?: string;
    revoked?: string;
    inviteError?: string;
    emailed?: string;
    deleted?: string;
  }>;
};

export default async function PlatformPage({ searchParams }: PlatformPageProps) {
  const user = await requirePlatformAdmin();
  const { created, invite, slug, revoked, inviteError, emailed, deleted } = await searchParams;
  const { stats, businesses, plans, activity, statusOptions, planOptions } = await getPlatformOverview();

  const inviteSlug = created ?? slug ?? "";
  const inviteUrl = invite ? buildInviteUrl(await getBaseUrl(), invite) : "";

  return (
    <main className="min-h-screen bg-[#fafafa] px-6 py-6 text-[#18181b] max-[720px]:px-3">
      <div className="mx-auto grid max-w-7xl gap-5">
        <header className="flex items-center justify-between gap-4 rounded-3xl border border-[#e7e7ea] bg-white px-5 py-4 shadow-[0_18px_45px_rgba(24,24,27,0.08)] max-[720px]:flex-col max-[720px]:items-start">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9d4e7a]">Beauty OS Platform</div>
            <h1 className="text-2xl font-semibold tracking-tight">Owner admin portal</h1>
            <p className="mt-1 text-sm font-semibold text-[#71717a]">
              Signed in as <span className="font-semibold text-[#18181b]">{user.email}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/platform/onboard" className="rounded-2xl bg-[#18181b] px-4 py-2 text-sm font-semibold text-white">
              Add business
            </Link>
            <Link href="/logout" className="rounded-2xl border border-[#e7e7ea] px-4 py-2 text-sm font-semibold">
              Sign out
            </Link>
          </div>
        </header>

        {inviteUrl ? (
          <div className="grid gap-2 rounded-2xl border border-[#efd6e4] bg-[#faf1f6] px-4 py-3 text-sm font-bold text-[#9d4e7a]">
            <span>
              {emailed ? (
                created ? (
                  <>Business <span className="font-semibold">{inviteSlug}</span> created and the invite was emailed to the owner. Backup link:</>
                ) : (
                  <>New invite emailed to the owner for <span className="font-semibold">{inviteSlug}</span>. Backup link:</>
                )
              ) : created ? (
                <>Business <span className="font-semibold">{inviteSlug}</span> created. Send the owner this invite link to set their password:</>
              ) : (
                <>New invite link for <span className="font-semibold">{inviteSlug}</span> — the previous link no longer works:</>
              )}
            </span>
            <input
              readOnly
              value={inviteUrl}
              className="w-full select-all rounded-xl border border-[#efd6e4] bg-white px-3 py-2 font-mono text-xs text-[#18181b]"
            />
            <span className="text-xs font-semibold text-[#9d4e7a]">
              {emailed ? "Emailed via Resend · " : ""}The link expires in 7 days.
            </span>
          </div>
        ) : null}

        {revoked ? (
          <div className="rounded-2xl border border-[#e6c6cd] bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
            Invite for <span className="font-semibold">{revoked}</span> revoked — that link no longer works. Resend to issue a new one.
          </div>
        ) : null}

        {deleted ? (
          <div className="rounded-2xl border border-[#e6c6cd] bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
            Business <span className="font-semibold">{deleted}</span> and all its data were permanently deleted.
          </div>
        ) : null}

        {inviteError ? (
          <div className="rounded-2xl border border-[#e6c6cd] bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
            {inviteError}
          </div>
        ) : null}

        <section className="grid grid-cols-4 gap-4 max-[1080px]:grid-cols-2 max-[640px]:grid-cols-1">
          {stats.map((stat) => (
            <article key={stat.label} className="rounded-3xl border border-[#e7e7ea] bg-white p-5 shadow-[0_12px_35px_rgba(24,24,27,0.05)]">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#71717a]">{stat.label}</div>
              <div className="mt-4 text-3xl font-bold tracking-tight">{stat.value}</div>
              <div className="mt-2 text-sm font-semibold text-[#71717a]">{stat.detail}</div>
            </article>
          ))}
        </section>

        <section className={cardClass}>
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Businesses</h2>
            <p className="mt-1 text-sm text-[#71717a]">Manage every tenant — set account status and assign plans.</p>
          </div>

          <div className="grid grid-cols-2 gap-4 max-[900px]:grid-cols-1">
            {businesses.map((business) => (
              <article key={business.id} className="grid gap-4 rounded-[20px] border border-[#efeff2] bg-[#fbfbfc] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/${business.slug}`} className="text-base font-semibold text-[#18181b]">
                      {business.name}
                    </Link>
                    <div className="mt-0.5 text-xs font-semibold text-[#71717a]">
                      {business.category} · {business.slug}
                    </div>
                  </div>
                  <span className={`w-fit shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusPill[business.statusKey] ?? "bg-[#f2f2f4] text-[#71717a]"}`}>
                    {business.status}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-[#71717a]">
                  <span><strong className="text-[#18181b]">{business.staff}</strong> staff</span>
                  <span><strong className="text-[#18181b]">{business.customers}</strong> clients</span>
                  <span>Since {business.created}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-bold ring-1 ring-[#efeff2]">
                  <span>{business.planName}</span>
                  {business.subscriptionStatusKey ? (
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${subPill[business.subscriptionStatusKey] ?? "bg-[#f2f2f4] text-[#71717a]"}`}>
                      {business.subscriptionStatus}
                    </span>
                  ) : (
                    <span className="rounded-full bg-[#f2f2f4] px-2.5 py-0.5 text-[11px] font-semibold text-[#71717a]">No subscription</span>
                  )}
                </div>

                {!business.ownerActivated ? (
                  <div className="grid gap-2 rounded-2xl border border-amber-200 bg-amber-50/70 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-amber-700">
                        Owner not activated{business.inviteEmail ? ` · ${business.inviteEmail}` : ""}
                      </span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                        {inviteStateLabel[business.inviteState ?? "none"]}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <form action={resendInviteAction} className="flex-1">
                        <input type="hidden" name="businessId" value={business.id} />
                        <button className="w-full rounded-xl bg-[#18181b] px-3 py-2 text-xs font-semibold text-white">
                          {business.inviteState === "active" ? "Resend link" : "Send invite link"}
                        </button>
                      </form>
                      {business.inviteState === "active" ? (
                        <form action={revokeInviteAction}>
                          <input type="hidden" name="businessId" value={business.id} />
                          <button className="rounded-xl border border-[#e6c6cd] bg-white px-3 py-2 text-xs font-semibold text-rose-700">
                            Revoke
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-2">
                  <form action={setBusinessStatusAction} className="flex gap-2">
                    <input type="hidden" name="businessId" value={business.id} />
                    <select name="status" defaultValue={business.statusKey} className={`${inputClass} flex-1`}>
                      {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <button className="rounded-2xl border border-[#e7e7ea] bg-white px-4 text-sm font-semibold">Set status</button>
                  </form>
                  <form action={changeBusinessPlanAction} className="flex gap-2">
                    <input type="hidden" name="businessId" value={business.id} />
                    <select name="planId" defaultValue={business.planId ?? ""} className={`${inputClass} flex-1`}>
                      {business.planId === null ? <option value="">No plan</option> : null}
                      {planOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <button className="rounded-2xl bg-[#18181b] px-4 text-sm font-semibold text-white">Change plan</button>
                  </form>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-[#efeff2] pt-3">
                  <span className="text-[11px] font-bold text-[#a1a1aa]">Danger zone — permanent</span>
                  <DeleteBusinessButton businessId={business.id} slug={business.slug} action={deleteBusinessAction} />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-[minmax(0,1fr)_360px] gap-5 max-[1080px]:grid-cols-1">
          <div className={cardClass}>
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Plans</h2>
              <p className="mt-1 text-sm text-[#71717a]">Subscription tiers offered on the platform.</p>
            </div>
            <div className="grid gap-2">
              {plans.map((plan) => (
                <div key={plan.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#efeff2] px-4 py-3">
                  <div>
                    <div className="font-semibold">{plan.name}</div>
                    <div className="text-xs font-bold uppercase tracking-[0.12em] text-[#71717a]">{plan.key}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-[#71717a]">{plan.subscribers} {plan.subscribers === 1 ? "tenant" : "tenants"}</span>
                    <span className="font-semibold">{plan.price}<span className="text-xs font-bold text-[#71717a]">/mo</span></span>
                    {plan.active ? null : <span className="rounded-full bg-[#f2f2f4] px-2 py-0.5 text-[11px] font-semibold text-[#71717a]">Off</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={cardClass}>
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Recent activity</h2>
              <p className="mt-1 text-sm text-[#71717a]">Platform admin actions.</p>
            </div>
            {activity.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#e2e0f7] bg-[#f7f7f8] px-4 py-8 text-center text-sm font-semibold text-[#71717a]">
                No admin actions yet.
              </div>
            ) : (
              <div className="grid gap-2">
                {activity.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-[#efeff2] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-sm">{entry.action}</strong>
                      <span className="text-[11px] font-bold text-[#71717a]">{entry.when}</span>
                    </div>
                    <div className="mt-1 text-xs font-semibold text-[#71717a]">{entry.target}</div>
                    <div className="mt-0.5 text-[11px] font-bold text-[#a1a1aa]">{entry.actor}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
