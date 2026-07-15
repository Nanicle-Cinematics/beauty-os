import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createCampaignAction,
  createCouponAction,
  createTierAction,
  toggleCouponAction,
  updateLoyaltyAction,
} from "@/lib/marketing-actions";
import { getMarketingModuleData } from "@/lib/marketing-data";
import { requireTenantAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

type MarketingPageProps = {
  params: Promise<{
    businessSlug: string;
  }>;
};

const campaignStatusStyles: Record<string, string> = {
  DRAFT: "bg-[#f2f2f4] text-[#71717a]",
  SCHEDULED: "bg-amber-50 text-amber-700",
  SENT: "bg-[#faf1f6] text-[#9d4e7a]",
  CANCELLED: "bg-rose-50 text-rose-700",
};

const inputClass = "h-12 rounded-2xl border border-[#e7e7ea] bg-[#f7f7f8] px-4 outline-none focus:border-[#9d4e7a]";
const cardClass = "rounded-[24px] border border-[#e7e7ea] bg-white p-5 shadow-[0_12px_35px_rgba(24,24,27,0.06)]";

export default async function MarketingPage({ params }: MarketingPageProps) {
  const { businessSlug } = await params;
  await requireTenantAccess(businessSlug);
  const data = await getMarketingModuleData(businessSlug);

  if (!data) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#fafafa] px-6 py-6 text-[#18181b] max-[720px]:px-3">
      <div className="mx-auto grid max-w-7xl gap-5">
        <header className="flex items-center justify-between gap-4 rounded-3xl border border-[#e7e7ea] bg-white px-5 py-4 shadow-[0_18px_45px_rgba(24,24,27,0.08)] max-[720px]:flex-col max-[720px]:items-start">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9d4e7a]">
              {data.tenant.name}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Marketing</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/${businessSlug}`} className="rounded-2xl border border-[#e7e7ea] px-4 py-2 text-sm font-semibold">
              Dashboard
            </Link>
            <Link href={`/${businessSlug}/clients`} className="rounded-2xl border border-[#e7e7ea] px-4 py-2 text-sm font-semibold">
              Clients
            </Link>
            <Link href="/logout" className="rounded-2xl border border-[#e7e7ea] px-4 py-2 text-sm font-semibold">
              Sign out
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-4 gap-4 max-[1080px]:grid-cols-2 max-[640px]:grid-cols-1">
          {data.stats.map((stat) => (
            <article key={stat.label} className="rounded-3xl border border-[#e7e7ea] bg-white p-5 shadow-[0_12px_35px_rgba(24,24,27,0.05)]">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#71717a]">{stat.label}</div>
              <div className="mt-4 text-3xl font-bold tracking-tight">{stat.value}</div>
              <div className="mt-2 text-sm font-semibold text-[#71717a]">{stat.detail}</div>
            </article>
          ))}
        </section>

        {/* Campaigns + Loyalty */}
        <section className="grid grid-cols-[minmax(0,1fr)_360px] gap-5 max-[1080px]:grid-cols-1">
          <div className={cardClass}>
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Campaigns</h2>
              <p className="mt-1 text-sm text-[#71717a]">Reach clients over email, SMS, and WhatsApp.</p>
            </div>

            {data.campaigns.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#e2e0f7] bg-[#f7f7f8] px-4 py-8 text-center text-sm font-semibold text-[#71717a]">
                No campaigns yet. Create your first below.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[#e7e7ea]">
                <div className="grid grid-cols-[1.6fr_1fr_1fr_100px_90px] bg-[#f4f4f6] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#71717a] max-[940px]:hidden">
                  <span>Name</span><span>Channel</span><span>Type</span><span>When</span><span>Status</span>
                </div>
                {data.campaigns.map((campaign) => (
                  <div key={campaign.id} className="grid grid-cols-[1.6fr_1fr_1fr_100px_90px] items-center gap-3 border-t border-[#efeff2] px-4 py-4 text-sm max-[940px]:grid-cols-1">
                    <span className="font-semibold">{campaign.name}</span>
                    <span className="font-bold text-[#71717a]">{campaign.channel}</span>
                    <span className="font-bold">{campaign.type}</span>
                    <span className="font-bold text-[#71717a]">{campaign.when}</span>
                    <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${campaignStatusStyles[campaign.statusKey] ?? "bg-[#f2f2f4] text-[#71717a]"}`}>
                      {campaign.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <form action={createCampaignAction} className="mt-5 grid gap-3 rounded-2xl border border-[#efeff2] bg-[#f7f7f8] p-4">
              <input type="hidden" name="businessSlug" value={businessSlug} />
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#71717a]">New campaign</div>
              <input name="name" placeholder="Campaign name" className={inputClass} required />
              <div className="grid grid-cols-2 gap-3">
                <select name="channel" defaultValue="EMAIL" className={inputClass}>
                  {data.channels.map((channel) => (
                    <option key={channel.value} value={channel.value}>{channel.label}</option>
                  ))}
                </select>
                <select name="type" defaultValue="PROMO" className={inputClass}>
                  {data.types.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              <label className="grid gap-1 text-xs font-bold text-[#71717a]">
                Schedule (optional)
                <input name="scheduledAt" type="datetime-local" className={inputClass} />
              </label>
              <textarea name="content" rows={2} placeholder="Message content" className="rounded-2xl border border-[#e7e7ea] bg-white px-4 py-3 outline-none focus:border-[#9d4e7a]" />
              <button className="rounded-2xl bg-[#18181b] px-4 py-3 text-sm font-semibold text-white">Create campaign</button>
            </form>
          </div>

          <div className={cardClass}>
            <h2 className="text-lg font-semibold">Loyalty program</h2>
            <p className="mt-1 text-sm text-[#71717a]">
              {data.loyalty.pointsIssued.toLocaleString("en-US")} points issued · {data.loyalty.members} members
            </p>
            <div className="mt-3 inline-flex rounded-full bg-[#faf1f6] px-3 py-1 text-xs font-semibold text-[#9d4e7a]">
              {data.loyalty.active ? "Active" : "Inactive"}
            </div>

            <form action={updateLoyaltyAction} className="mt-5 grid gap-3">
              <input type="hidden" name="businessSlug" value={businessSlug} />
              <label className="grid gap-1 text-xs font-bold text-[#71717a]">
                Points per {data.tenant.currency === "GHS" ? "GH₵" : data.tenant.currency} spent
                <input name="pointsPerCurrencyUnit" type="number" min="0" step="0.1" defaultValue={data.loyalty.pointsPerCurrencyUnit} className={inputClass} />
              </label>
              <label className="grid gap-1 text-xs font-bold text-[#71717a]">
                Redemption rate (points per unit)
                <input name="redemptionRate" type="number" min="0" step="0.1" defaultValue={data.loyalty.redemptionRate} className={inputClass} />
              </label>
              <label className="flex items-center gap-2 text-sm font-bold">
                <input type="checkbox" name="active" defaultChecked={data.loyalty.active} className="size-4 accent-[#9d4e7a]" />
                Program active
              </label>
              <button className="rounded-2xl bg-[#18181b] px-4 py-3 text-sm font-semibold text-white">Save program</button>
            </form>
          </div>
        </section>

        {/* Coupons + Tiers */}
        <section className="grid grid-cols-[minmax(0,1fr)_360px] gap-5 max-[1080px]:grid-cols-1">
          <div className={cardClass}>
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Discount coupons</h2>
              <p className="mt-1 text-sm text-[#71717a]">Codes clients can redeem at checkout.</p>
            </div>

            {data.coupons.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#e2e0f7] bg-[#f7f7f8] px-4 py-8 text-center text-sm font-semibold text-[#71717a]">
                No coupons yet. Create your first below.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[#e7e7ea]">
                <div className="grid grid-cols-[1.3fr_100px_90px_100px_110px] bg-[#f4f4f6] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#71717a] max-[940px]:hidden">
                  <span>Code</span><span>Discount</span><span>Uses</span><span>Expiry</span><span>Status</span>
                </div>
                {data.coupons.map((coupon) => (
                  <div key={coupon.id} className={`grid grid-cols-[1.3fr_100px_90px_100px_110px] items-center gap-3 border-t border-[#efeff2] px-4 py-4 text-sm max-[940px]:grid-cols-1 ${coupon.active ? "" : "opacity-60"}`}>
                    <span className="font-semibold tracking-wide">{coupon.code}</span>
                    <span className="font-bold">{coupon.discount}</span>
                    <span className="font-bold text-[#71717a]">{coupon.uses}</span>
                    <span className="font-bold text-[#71717a]">{coupon.expiry}</span>
                    <form action={toggleCouponAction} className="flex items-center gap-2">
                      <input type="hidden" name="businessSlug" value={businessSlug} />
                      <input type="hidden" name="couponId" value={coupon.id} />
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${coupon.active ? "bg-[#faf1f6] text-[#9d4e7a]" : "bg-[#f2f2f4] text-[#71717a]"}`}>
                        {coupon.active ? "Active" : "Off"}
                      </span>
                      <button className="rounded-lg border border-[#e7e7ea] px-2.5 py-1 text-xs font-semibold">
                        {coupon.active ? "Disable" : "Enable"}
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}

            <form action={createCouponAction} className="mt-5 grid gap-3 rounded-2xl border border-[#efeff2] bg-[#f7f7f8] p-4">
              <input type="hidden" name="businessSlug" value={businessSlug} />
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#71717a]">New coupon</div>
              <div className="grid grid-cols-2 gap-3">
                <input name="code" placeholder="CODE" className={`${inputClass} uppercase`} required />
                <select name="discountType" defaultValue="PERCENT" className={inputClass}>
                  <option value="PERCENT">Percent %</option>
                  <option value="FIXED">Fixed amount</option>
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <input name="value" type="number" min="0" step="0.01" placeholder="Value" className={inputClass} required />
                <input name="maxUses" type="number" min="1" step="1" placeholder="Max uses" className={inputClass} />
                <input name="expiresAt" type="date" className={inputClass} />
              </div>
              <button className="rounded-2xl bg-[#18181b] px-4 py-3 text-sm font-semibold text-white">Create coupon</button>
            </form>
          </div>

          <div className={cardClass}>
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Membership tiers</h2>
              <p className="mt-1 text-sm text-[#71717a]">Reward your best clients.</p>
            </div>

            {data.tiers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#e2e0f7] bg-[#f7f7f8] px-4 py-6 text-center text-sm font-semibold text-[#71717a]">
                No tiers yet.
              </div>
            ) : (
              <div className="grid gap-2">
                {data.tiers.map((tier) => (
                  <div key={tier.id} className="rounded-2xl border border-[#efeff2] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <strong>{tier.name}</strong>
                      <span className="rounded-full bg-[#f6edf0] px-2 py-1 text-[11px] font-semibold text-rose-700">{tier.discount}</span>
                    </div>
                    <div className="mt-1 text-xs font-semibold text-[#71717a]">{tier.threshold}</div>
                    {tier.perks !== "—" ? <div className="mt-1 text-xs text-[#71717a]">{tier.perks}</div> : null}
                  </div>
                ))}
              </div>
            )}

            <form action={createTierAction} className="mt-5 grid gap-3 rounded-2xl border border-[#efeff2] bg-[#f7f7f8] p-4">
              <input type="hidden" name="businessSlug" value={businessSlug} />
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#71717a]">New tier</div>
              <input name="name" placeholder="Tier name (e.g. Gold)" className={inputClass} required />
              <div className="grid grid-cols-2 gap-3">
                <input name="minSpend" type="number" min="0" step="1" placeholder="Min spend" className={inputClass} />
                <input name="discountPercent" type="number" min="0" max="100" step="1" placeholder="Discount %" className={inputClass} />
              </div>
              <input name="perks" placeholder="Perks (optional)" className={inputClass} />
              <button className="rounded-2xl bg-[#18181b] px-4 py-3 text-sm font-semibold text-white">Create tier</button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
