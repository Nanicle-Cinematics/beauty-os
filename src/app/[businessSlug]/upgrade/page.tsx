import Link from "next/link";
import { Check, Lock, Mail, Sparkles, Users } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { requireTenantAccess } from "@/lib/auth";
import { getUpgradeOptions } from "@/lib/upgrade-data";
import { MODULE_LABEL, type ModuleKey } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

type UpgradePageProps = {
  params: Promise<{ businessSlug: string }>;
  searchParams: Promise<{ module?: string; reason?: string }>;
};

export default async function UpgradePage({ params, searchParams }: UpgradePageProps) {
  const { businessSlug } = await params;
  // Deliberately ungated: this is where every lock sends people, so it must open
  // on any plan. Gating it would make a locked module a dead end.
  await requireTenantAccess(businessSlug);

  const { module: requestedModule, reason } = await searchParams;
  const data = await getUpgradeOptions(businessSlug);
  const seatsBlocked = reason === "seats";

  const blocked =
    requestedModule && requestedModule in MODULE_LABEL && data.lockedModules.includes(requestedModule as ModuleKey)
      ? (requestedModule as ModuleKey)
      : null;

  const mailSubject = encodeURIComponent(`Upgrade ${data.businessName} on Beauty OS`);
  const mailBody = encodeURIComponent(
    `Hello,\n\nI'd like to upgrade ${data.businessName} (${businessSlug}) from ${data.currentPlanName} to ${
      data.upgrade?.name ?? "a higher plan"
    }.\n\nThank you.`,
  );
  const mailto = `mailto:naniclecinematics@gmail.com?subject=${mailSubject}&body=${mailBody}`;

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Your plan"
        description={`${data.businessName} is on ${data.currentPlanName}.`}
      />

      {blocked ? (
        <section className="card border-warning/30 bg-warning-soft p-5">
          <div className="flex items-start gap-3">
            <Lock size={18} className="mt-0.5 shrink-0 text-warning" />
            <div>
              <h2 className="text-[15px] font-semibold text-ink">
                {MODULE_LABEL[blocked]} is not included in {data.currentPlanName}
              </h2>
              <p className="mt-1 text-[13.5px] leading-6 text-muted">
                {data.upgrade
                  ? `${data.upgrade.name} unlocks it, along with everything else listed below. Nothing in your workspace has been deleted — the data is here whenever you upgrade.`
                  : "Get in touch and we'll sort out access for you."}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {seatsBlocked ? (
        <section className="card border-warning/30 bg-warning-soft p-5">
          <div className="flex items-start gap-3">
            <Users size={18} className="mt-0.5 shrink-0 text-warning" />
            <div>
              <h2 className="text-[15px] font-semibold text-ink">
                {data.currentPlanName} includes {data.seatLimit} staff {data.seatLimit === 1 ? "seat" : "seats"}
              </h2>
              <p className="mt-1 text-[13.5px] leading-6 text-muted">
                All of them are in use, so there is no room for another team member.{" "}
                {data.upgrade?.seatLimit
                  ? `${data.upgrade.name} raises this to ${data.upgrade.seatLimit}.`
                  : "Get in touch and we'll raise it for you."}{" "}
                Nobody already on your team has been affected.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {data.onTrial ? (
        <section className="card border-plum/25 bg-plum-soft p-5">
          <div className="flex items-start gap-3">
            <Sparkles size={18} className="mt-0.5 shrink-0 text-plum" />
            <div>
              <h2 className="text-[15px] font-semibold text-ink">You have the full product during your trial</h2>
              <p className="mt-1 text-[13.5px] leading-6 text-muted">
                Every module is open while you try Beauty OS. Choosing a plan before the trial ends keeps the ones
                you rely on.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <div className="field-label">Current plan</div>
          <h2 className="mt-1 font-serif text-[22px] font-semibold text-ink">{data.currentPlanName}</h2>
          {data.currentPrice ? (
            <div className="mt-0.5 text-[13px] text-muted">{data.currentPrice} / month</div>
          ) : null}

          <ul className="mt-4 grid gap-2">
            {data.currentFeatures.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-[13.5px] leading-6 text-ink">
                <Check size={15} className="mt-1 shrink-0 text-success" />
                {feature}
              </li>
            ))}
          </ul>

          <div className="mt-4 border-t border-line pt-3 text-[12.5px] leading-5 text-muted">
            {data.seatLimit === null
              ? `${data.seatsUsed} staff on the team · unlimited seats`
              : `${data.seatsUsed} of ${data.seatLimit} staff seats used`}
          </div>
        </div>

        {data.upgrade ? (
          <div className="card border-plum/30 p-5">
            <div className="field-label text-plum">Recommended</div>
            <h2 className="mt-1 font-serif text-[22px] font-semibold text-ink">{data.upgrade.name}</h2>
            <div className="mt-0.5 text-[13px] text-muted">{data.upgrade.priceMonthly} / month</div>

            <ul className="mt-4 grid gap-2">
              {data.upgrade.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-[13.5px] leading-6 text-ink">
                  <Check size={15} className="mt-1 shrink-0 text-plum" />
                  {feature}
                </li>
              ))}
            </ul>

            {data.upgrade.seatLimit !== null ? (
              <div className="mt-4 border-t border-line pt-3 text-[12.5px] leading-5 text-muted">
                Up to {data.upgrade.seatLimit} staff seats
              </div>
            ) : null}

            <a
              href={mailto}
              className="primary-action mt-4 flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[13.5px] font-semibold text-white"
            >
              <Mail size={15} /> Ask us to upgrade
            </a>
            <p className="mt-2 text-center text-[11.5px] leading-5 text-faint">
              We&apos;ll confirm by email and switch your plan over — no card needed yet.
            </p>
          </div>
        ) : (
          <div className="card p-5">
            <div className="field-label">Everything unlocked</div>
            <h2 className="mt-1 font-serif text-[20px] font-semibold text-ink">You have the full product</h2>
            <p className="mt-2 text-[13.5px] leading-6 text-muted">
              Every module in Beauty OS is available on your plan. If you need more staff seats or a second branch,
              get in touch.
            </p>
            <a
              href={mailto}
              className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-line bg-sunken px-4 py-3 text-[13.5px] font-semibold text-ink transition hover:border-plum/40"
            >
              <Mail size={15} /> Contact us
            </a>
          </div>
        )}
      </section>

      {data.lockedModules.length > 0 ? (
        <section className="card p-5">
          <h2 className="text-[15px] font-semibold text-ink">Locked on your plan</h2>
          <p className="mt-1 text-[13.5px] leading-6 text-muted">
            These stay in your sidebar so you can see what&apos;s available. Your data in them is untouched.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.lockedModules.map((module) => (
              <span
                key={module}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-sunken px-3 py-1.5 text-[12.5px] font-medium text-muted"
              >
                <Lock size={12} className="text-faint" /> {MODULE_LABEL[module]}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <p className="text-[12.5px] text-muted">
        Billing details and invoices live in{" "}
        <Link href={`/${businessSlug}/settings#subscription`} className="font-semibold text-plum hover:underline">
          business settings
        </Link>
        .
      </p>
    </div>
  );
}
