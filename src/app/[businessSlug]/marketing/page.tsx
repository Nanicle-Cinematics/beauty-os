import { Megaphone, Ticket, Crown } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatTile, statMetaFor, EmptyState, Badge, toneForStatus } from "@/components/ui";
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

const inputClass = "input";
const cardClass = "card p-5";

export default async function MarketingPage({ params }: MarketingPageProps) {
  const { businessSlug } = await params;
  await requireTenantAccess(businessSlug);
  const data = await getMarketingModuleData(businessSlug);

  if (!data) {
    notFound();
  }

  return (
    <div className="grid gap-5">
      <PageHeader title="Marketing" description="Campaigns, offers, and loyalty to keep chairs full." />

        <section className="grid grid-cols-4 gap-4 max-[1080px]:grid-cols-2 max-[640px]:grid-cols-1">
          {data.stats.map((stat) => {
            const meta = statMetaFor(stat.label);
            return (
              <StatTile key={stat.label} label={stat.label} value={stat.value} detail={stat.detail} icon={meta.icon} tone={meta.tone} />
            );
          })}
        </section>

        {/* Campaigns + Loyalty */}
        <section className="grid grid-cols-[minmax(0,1fr)_360px] gap-5 max-[1080px]:grid-cols-1">
          <div className={cardClass}>
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Campaigns</h2>
              <p className="mt-1 text-sm text-muted">Reach clients over email, SMS, and WhatsApp.</p>
            </div>

            {data.campaigns.length === 0 ? (
              <EmptyState icon={Megaphone} title="No campaigns yet" body="Create your first campaign below." />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-line">
                <div className="grid grid-cols-[1.6fr_1fr_1fr_100px_90px] px-4 py-2.5 data-head max-[940px]:hidden">
                  <span>Name</span><span>Channel</span><span>Type</span><span>When</span><span>Status</span>
                </div>
                {data.campaigns.map((campaign) => (
                  <div key={campaign.id} className="grid grid-cols-[1.6fr_1fr_1fr_100px_90px] items-center gap-3 border-t border-line-2 px-4 py-3.5 text-sm max-[940px]:grid-cols-1">
                    <span className="font-semibold text-ink">{campaign.name}</span>
                    <span className="font-medium text-muted">{campaign.channel}</span>
                    <span className="font-medium text-ink">{campaign.type}</span>
                    <span className="font-medium text-muted">{campaign.when}</span>
                    <Badge tone={toneForStatus(campaign.status)}>{campaign.status}</Badge>
                  </div>
                ))}
              </div>
            )}

            <form action={createCampaignAction} className="mt-5 grid gap-3 rounded-2xl border border-line-2 bg-sunken p-4">
              <input type="hidden" name="businessSlug" value={businessSlug} />
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">New campaign</div>
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
              <label className="grid gap-1 text-xs font-bold text-muted">
                Schedule (optional)
                <input name="scheduledAt" type="datetime-local" className={inputClass} />
              </label>
              <textarea name="content" rows={2} placeholder="Message content" className="rounded-xl border border-line bg-card px-3.5 py-2.5 text-ink outline-none focus:border-plum" />
              <button className="rounded-2xl bg-gradient-to-r from-plum to-wine px-4 py-3 text-sm font-semibold text-white">Create campaign</button>
            </form>
          </div>

          <div className={cardClass}>
            <h2 className="text-lg font-semibold">Loyalty program</h2>
            <p className="mt-1 text-sm text-muted">
              {data.loyalty.pointsIssued.toLocaleString("en-US")} points issued · {data.loyalty.members} members
            </p>
            <div className="mt-3">
              <Badge tone={data.loyalty.active ? "success" : "neutral"}>{data.loyalty.active ? "Active" : "Inactive"}</Badge>
            </div>

            <form action={updateLoyaltyAction} className="mt-5 grid gap-3">
              <input type="hidden" name="businessSlug" value={businessSlug} />
              <label className="grid gap-1 text-xs font-bold text-muted">
                Points per {data.tenant.currency === "GHS" ? "GH₵" : data.tenant.currency} spent
                <input name="pointsPerCurrencyUnit" type="number" min="0" step="0.1" defaultValue={data.loyalty.pointsPerCurrencyUnit} className={inputClass} />
              </label>
              <label className="grid gap-1 text-xs font-bold text-muted">
                Redemption rate (points per unit)
                <input name="redemptionRate" type="number" min="0" step="0.1" defaultValue={data.loyalty.redemptionRate} className={inputClass} />
              </label>
              <label className="flex items-center gap-2 text-sm font-bold">
                <input type="checkbox" name="active" defaultChecked={data.loyalty.active} className="size-4 accent-plum" />
                Program active
              </label>
              <button className="rounded-2xl bg-gradient-to-r from-plum to-wine px-4 py-3 text-sm font-semibold text-white">Save program</button>
            </form>
          </div>
        </section>

        {/* Coupons + Tiers */}
        <section className="grid grid-cols-[minmax(0,1fr)_360px] gap-5 max-[1080px]:grid-cols-1">
          <div className={cardClass}>
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Discount coupons</h2>
              <p className="mt-1 text-sm text-muted">Codes clients can redeem at checkout.</p>
            </div>

            {data.coupons.length === 0 ? (
              <EmptyState icon={Ticket} title="No coupons yet" body="Create your first coupon below." />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-line">
                <div className="grid grid-cols-[1.3fr_100px_90px_100px_110px] px-4 py-2.5 data-head max-[940px]:hidden">
                  <span>Code</span><span>Discount</span><span>Uses</span><span>Expiry</span><span>Status</span>
                </div>
                {data.coupons.map((coupon) => (
                  <div key={coupon.id} className={`grid grid-cols-[1.3fr_100px_90px_100px_110px] items-center gap-3 border-t border-line-2 px-4 py-3.5 text-sm max-[940px]:grid-cols-1 ${coupon.active ? "" : "opacity-60"}`}>
                    <span className="font-mono text-[13px] font-semibold uppercase tracking-wide text-plum">{coupon.code}</span>
                    <span className="font-semibold text-ink">{coupon.discount}</span>
                    <span className="font-medium text-muted">{coupon.uses}</span>
                    <span className="font-medium text-muted">{coupon.expiry}</span>
                    <form action={toggleCouponAction} className="flex items-center gap-2">
                      <input type="hidden" name="businessSlug" value={businessSlug} />
                      <input type="hidden" name="couponId" value={coupon.id} />
                      <Badge tone={coupon.active ? "success" : "neutral"}>{coupon.active ? "Active" : "Off"}</Badge>
                      <button className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-muted hover:border-plum-line hover:bg-plum-soft hover:text-plum">
                        {coupon.active ? "Disable" : "Enable"}
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}

            <form action={createCouponAction} className="mt-5 grid gap-3 rounded-2xl border border-line-2 bg-sunken p-4">
              <input type="hidden" name="businessSlug" value={businessSlug} />
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">New coupon</div>
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
              <button className="rounded-2xl bg-gradient-to-r from-plum to-wine px-4 py-3 text-sm font-semibold text-white">Create coupon</button>
            </form>
          </div>

          <div className={cardClass}>
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Membership tiers</h2>
              <p className="mt-1 text-sm text-muted">Reward your best clients.</p>
            </div>

            {data.tiers.length === 0 ? (
              <EmptyState icon={Crown} title="No tiers yet" body="Reward your best clients with a membership tier." />
            ) : (
              <div className="grid gap-2">
                {data.tiers.map((tier) => (
                  <div key={tier.id} className="rounded-2xl border border-line-2 p-3.5 hover:border-plum-line">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="flex items-center gap-2 text-ink">
                        <Crown size={14} className="text-gold" /> {tier.name}
                      </strong>
                      <Badge>{tier.discount}</Badge>
                    </div>
                    <div className="mt-1 text-xs font-medium text-muted">{tier.threshold}</div>
                    {tier.perks !== "—" ? <div className="mt-1 text-xs text-muted">{tier.perks}</div> : null}
                  </div>
                ))}
              </div>
            )}

            <form action={createTierAction} className="mt-5 grid gap-3 rounded-2xl border border-line-2 bg-sunken p-4">
              <input type="hidden" name="businessSlug" value={businessSlug} />
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">New tier</div>
              <input name="name" placeholder="Tier name (e.g. Gold)" className={inputClass} required />
              <div className="grid grid-cols-2 gap-3">
                <input name="minSpend" type="number" min="0" step="1" placeholder="Min spend" className={inputClass} />
                <input name="discountPercent" type="number" min="0" max="100" step="1" placeholder="Discount %" className={inputClass} />
              </div>
              <input name="perks" placeholder="Perks (optional)" className={inputClass} />
              <button className="rounded-2xl bg-gradient-to-r from-plum to-wine px-4 py-3 text-sm font-semibold text-white">Create tier</button>
            </form>
          </div>
        </section>
    </div>
  );
}
