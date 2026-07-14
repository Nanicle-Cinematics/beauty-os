import Link from "next/link";
import { getPlatformOverview } from "@/lib/platform-data";
import {
  setBusinessStatusAction,
  changeBusinessPlanAction,
  resendInviteAction,
  revokeInviteAction,
} from "@/lib/platform-actions";
import { requirePlatformAdmin } from "@/lib/auth";
import { getBaseUrl, inviteUrl as buildInviteUrl } from "@/lib/urls";

export const dynamic = "force-dynamic";

const statusPill: Record<string, string> = {
  ACTIVE: "bg-[#eff7f2] text-[#1d7b5d]",
  TRIAL: "bg-amber-50 text-amber-700",
  SUSPENDED: "bg-rose-50 text-rose-700",
  CLOSED: "bg-[#eef1f0] text-[#6b7c73]",
};

const subPill: Record<string, string> = {
  ACTIVE: "bg-[#eff7f2] text-[#1d7b5d]",
  TRIALING: "bg-amber-50 text-amber-700",
  PAST_DUE: "bg-rose-50 text-rose-700",
  CANCELED: "bg-[#eef1f0] text-[#6b7c73]",
};

const inviteStateLabel: Record<string, string> = {
  active: "Invite sent",
  revoked: "Revoked",
  expired: "Expired",
  none: "No invite",
};

const inputClass = "h-11 rounded-2xl border border-[#dbe4de] bg-[#f8faf8] px-3 text-sm outline-none focus:border-[#1d7b5d]";
const cardClass = "rounded-[24px] border border-[#dbe4de] bg-white p-5 shadow-[0_12px_35px_rgba(16,38,31,0.06)]";

type PlatformPageProps = {
  searchParams: Promise<{
    created?: string;
    invite?: string;
    slug?: string;
    resent?: string;
    revoked?: string;
    inviteError?: string;
    emailed?: string;
  }>;
};

export default async function PlatformPage({ searchParams }: PlatformPageProps) {
  const user = await requirePlatformAdmin();
  const { created, invite, slug, revoked, inviteError, emailed } = await searchParams;
  const { stats, businesses, plans, activity, statusOptions, planOptions } = await getPlatformOverview();

  const inviteSlug = created ?? slug ?? "";
  const inviteUrl = invite ? buildInviteUrl(await getBaseUrl(), invite) : "";

  return (
    <main className="min-h-screen bg-[#f6f8f6] px-6 py-6 text-[#111b17] max-[720px]:px-3">
      <div className="mx-auto grid max-w-7xl gap-5">
        <header className="flex items-center justify-between gap-4 rounded-3xl border border-[#dbe4de] bg-white px-5 py-4 shadow-[0_18px_45px_rgba(16,38,31,0.08)] max-[720px]:flex-col max-[720px]:items-start">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#1d7b5d]">Beauty OS Platform</div>
            <h1 className="text-2xl font-black tracking-tight">Owner admin portal</h1>
            <p className="mt-1 text-sm font-semibold text-[#6b7c73]">
              Signed in as <span className="font-black text-[#111b17]">{user.email}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/platform/onboard" className="rounded-2xl bg-[#10261f] px-4 py-2 text-sm font-black text-white">
              Add business
            </Link>
            <Link href="/logout" className="rounded-2xl border border-[#dbe4de] px-4 py-2 text-sm font-black">
              Sign out
            </Link>
          </div>
        </header>

        {inviteUrl ? (
          <div className="grid gap-2 rounded-2xl border border-[#bfe3d1] bg-[#eff7f2] px-4 py-3 text-sm font-bold text-[#1d7b5d]">
            <span>
              {emailed ? (
                created ? (
                  <>Business <span className="font-black">{inviteSlug}</span> created and the invite was emailed to the owner. Backup link:</>
                ) : (
                  <>New invite emailed to the owner for <span className="font-black">{inviteSlug}</span>. Backup link:</>
                )
              ) : created ? (
                <>Business <span className="font-black">{inviteSlug}</span> created. Send the owner this invite link to set their password:</>
              ) : (
                <>New invite link for <span className="font-black">{inviteSlug}</span> — the previous link no longer works:</>
              )}
            </span>
            <input
              readOnly
              value={inviteUrl}
              className="w-full select-all rounded-xl border border-[#bfe3d1] bg-white px-3 py-2 font-mono text-xs text-[#10261f]"
            />
            <span className="text-xs font-semibold text-[#4c9c78]">
              {emailed ? "Emailed via Resend · " : ""}The link expires in 7 days.
            </span>
          </div>
        ) : null}

        {revoked ? (
          <div className="rounded-2xl border border-[#e6c6cd] bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
            Invite for <span className="font-black">{revoked}</span> revoked — that link no longer works. Resend to issue a new one.
          </div>
        ) : null}

        {inviteError ? (
          <div className="rounded-2xl border border-[#e6c6cd] bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
            {inviteError}
          </div>
        ) : null}

        <section className="grid grid-cols-4 gap-4 max-[1080px]:grid-cols-2 max-[640px]:grid-cols-1">
          {stats.map((stat) => (
            <article key={stat.label} className="rounded-3xl border border-[#dbe4de] bg-white p-5 shadow-[0_12px_35px_rgba(16,38,31,0.05)]">
              <div className="text-xs font-black uppercase tracking-[0.12em] text-[#6b7c73]">{stat.label}</div>
              <div className="mt-4 text-3xl font-black tracking-tight">{stat.value}</div>
              <div className="mt-2 text-sm font-semibold text-[#6b7c73]">{stat.detail}</div>
            </article>
          ))}
        </section>

        <section className={cardClass}>
          <div className="mb-4">
            <h2 className="text-lg font-black">Businesses</h2>
            <p className="mt-1 text-sm text-[#6b7c73]">Manage every tenant — set account status and assign plans.</p>
          </div>

          <div className="grid grid-cols-2 gap-4 max-[900px]:grid-cols-1">
            {businesses.map((business) => (
              <article key={business.id} className="grid gap-4 rounded-[20px] border border-[#e6eee9] bg-[#fbfdfb] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/${business.slug}`} className="text-base font-black text-[#10261f]">
                      {business.name}
                    </Link>
                    <div className="mt-0.5 text-xs font-semibold text-[#6b7c73]">
                      {business.category} · {business.slug}
                    </div>
                  </div>
                  <span className={`w-fit shrink-0 rounded-full px-3 py-1 text-xs font-black ${statusPill[business.statusKey] ?? "bg-[#eef1f0] text-[#6b7c73]"}`}>
                    {business.status}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-[#6b7c73]">
                  <span><strong className="text-[#111b17]">{business.staff}</strong> staff</span>
                  <span><strong className="text-[#111b17]">{business.customers}</strong> clients</span>
                  <span>Since {business.created}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-bold ring-1 ring-[#e6eee9]">
                  <span>{business.planName}</span>
                  {business.subscriptionStatusKey ? (
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${subPill[business.subscriptionStatusKey] ?? "bg-[#eef1f0] text-[#6b7c73]"}`}>
                      {business.subscriptionStatus}
                    </span>
                  ) : (
                    <span className="rounded-full bg-[#eef1f0] px-2.5 py-0.5 text-[11px] font-black text-[#6b7c73]">No subscription</span>
                  )}
                </div>

                {!business.ownerActivated ? (
                  <div className="grid gap-2 rounded-2xl border border-amber-200 bg-amber-50/70 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-amber-700">
                        Owner not activated{business.inviteEmail ? ` · ${business.inviteEmail}` : ""}
                      </span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-700">
                        {inviteStateLabel[business.inviteState ?? "none"]}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <form action={resendInviteAction} className="flex-1">
                        <input type="hidden" name="businessId" value={business.id} />
                        <button className="w-full rounded-xl bg-[#10261f] px-3 py-2 text-xs font-black text-white">
                          {business.inviteState === "active" ? "Resend link" : "Send invite link"}
                        </button>
                      </form>
                      {business.inviteState === "active" ? (
                        <form action={revokeInviteAction}>
                          <input type="hidden" name="businessId" value={business.id} />
                          <button className="rounded-xl border border-[#e6c6cd] bg-white px-3 py-2 text-xs font-black text-rose-700">
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
                    <button className="rounded-2xl border border-[#dbe4de] bg-white px-4 text-sm font-black">Set status</button>
                  </form>
                  <form action={changeBusinessPlanAction} className="flex gap-2">
                    <input type="hidden" name="businessId" value={business.id} />
                    <select name="planId" defaultValue={business.planId ?? ""} className={`${inputClass} flex-1`}>
                      {business.planId === null ? <option value="">No plan</option> : null}
                      {planOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <button className="rounded-2xl bg-[#10261f] px-4 text-sm font-black text-white">Change plan</button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-[minmax(0,1fr)_360px] gap-5 max-[1080px]:grid-cols-1">
          <div className={cardClass}>
            <div className="mb-4">
              <h2 className="text-lg font-black">Plans</h2>
              <p className="mt-1 text-sm text-[#6b7c73]">Subscription tiers offered on the platform.</p>
            </div>
            <div className="grid gap-2">
              {plans.map((plan) => (
                <div key={plan.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#e6eee9] px-4 py-3">
                  <div>
                    <div className="font-black">{plan.name}</div>
                    <div className="text-xs font-bold uppercase tracking-[0.12em] text-[#6b7c73]">{plan.key}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-[#6b7c73]">{plan.subscribers} {plan.subscribers === 1 ? "tenant" : "tenants"}</span>
                    <span className="font-black">{plan.price}<span className="text-xs font-bold text-[#6b7c73]">/mo</span></span>
                    {plan.active ? null : <span className="rounded-full bg-[#eef1f0] px-2 py-0.5 text-[11px] font-black text-[#6b7c73]">Off</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={cardClass}>
            <div className="mb-4">
              <h2 className="text-lg font-black">Recent activity</h2>
              <p className="mt-1 text-sm text-[#6b7c73]">Platform admin actions.</p>
            </div>
            {activity.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#cdddd4] bg-[#f8faf8] px-4 py-8 text-center text-sm font-semibold text-[#6b7c73]">
                No admin actions yet.
              </div>
            ) : (
              <div className="grid gap-2">
                {activity.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-[#e6eee9] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-sm">{entry.action}</strong>
                      <span className="text-[11px] font-bold text-[#6b7c73]">{entry.when}</span>
                    </div>
                    <div className="mt-1 text-xs font-semibold text-[#6b7c73]">{entry.target}</div>
                    <div className="mt-0.5 text-[11px] font-bold text-[#8a978f]">{entry.actor}</div>
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
