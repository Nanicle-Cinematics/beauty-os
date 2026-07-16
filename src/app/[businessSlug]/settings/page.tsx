import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { requireTenantAccess } from "@/lib/auth";
import { getBusinessSettings, WEEKDAYS } from "@/lib/business-settings-data";
import { updateBusinessDetailsAction, updateBusinessHoursAction } from "@/lib/business-settings-actions";
import { CURRENCIES, TIMEZONES } from "@/lib/onboarding-data";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ businessSlug: string }>;
  searchParams: Promise<{ updated?: string; error?: string }>;
};

const inputClass = "h-11 w-full rounded-xl border border-line bg-sunken px-3.5 text-sm text-ink outline-none focus:border-plum";
const labelClass = "grid gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted";
const cardClass = "grid gap-4 card p-5";
const saveBtn = "mt-1 w-fit rounded-xl bg-gradient-to-r from-plum to-wine px-6 py-2.5 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(84,33,63,0.28)]";

export default async function BusinessSettingsPage({ params, searchParams }: Props) {
  const { businessSlug } = await params;
  await requireTenantAccess(businessSlug);
  const [{ updated, error }, settings] = await Promise.all([searchParams, getBusinessSettings(businessSlug)]);
  if (!settings) notFound();

  const updatedMsg = updated === "hours" ? "Business hours saved." : updated === "details" ? "Business details saved." : null;

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <header>
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-plum">Workspace</div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Business settings</h1>
        <p className="mt-1 text-sm text-muted">Your studio&rsquo;s profile, locale, and opening hours. These appear on client-facing pages, receipts, and scheduling.</p>
      </header>

      {updatedMsg ? (
        <div className="rounded-2xl border border-plum/20 bg-plum/5 px-4 py-3 text-sm font-semibold text-plum">{updatedMsg}</div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">{error}</div>
      ) : null}

      {/* Business details */}
      <form action={updateBusinessDetailsAction} className={cardClass}>
        <input type="hidden" name="slug" value={settings.slug} />
        <div>
          <h2 className="text-lg font-semibold text-ink">Profile</h2>
          <p className="mt-1 text-sm text-muted">The basics clients and receipts show.</p>
        </div>

        <label className={labelClass}>
          Business name
          <input name="name" defaultValue={settings.name} required maxLength={60} className={inputClass} />
        </label>
        <label className={labelClass}>
          Description (optional)
          <textarea name="description" defaultValue={settings.description} rows={2} maxLength={280} className="w-full rounded-xl border border-line bg-sunken px-3.5 py-2.5 text-sm text-ink outline-none focus:border-plum" />
        </label>
        <div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
          <label className={labelClass}>
            Contact email
            <input name="email" type="email" defaultValue={settings.email} placeholder="hello@studio.com" className={inputClass} />
          </label>
          <label className={labelClass}>
            Phone
            <input name="phone" defaultValue={settings.phone} placeholder="+233 …" className={inputClass} />
          </label>
        </div>
        <label className={labelClass}>
          Logo URL (optional)
          <input name="logoUrl" defaultValue={settings.logoUrl} placeholder="https://…" className={inputClass} />
        </label>

        <div className="mt-2 border-t border-line pt-4">
          <h3 className="text-sm font-semibold text-ink">Address</h3>
        </div>
        <label className={labelClass}>
          Address line 1
          <input name="addressLine1" defaultValue={settings.addressLine1} className={inputClass} />
        </label>
        <label className={labelClass}>
          Address line 2 (optional)
          <input name="addressLine2" defaultValue={settings.addressLine2} className={inputClass} />
        </label>
        <div className="grid grid-cols-3 gap-3 max-[560px]:grid-cols-1">
          <label className={labelClass}>
            City
            <input name="city" defaultValue={settings.city} className={inputClass} />
          </label>
          <label className={labelClass}>
            Region
            <input name="region" defaultValue={settings.region} className={inputClass} />
          </label>
          <label className={labelClass}>
            Country
            <input name="country" defaultValue={settings.country} className={inputClass} />
          </label>
        </div>

        <div className="mt-2 border-t border-line pt-4">
          <h3 className="text-sm font-semibold text-ink">Locale &amp; tax</h3>
        </div>
        <div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
          <label className={labelClass}>
            Timezone
            <select name="timezone" defaultValue={settings.timezone} className={inputClass}>
              {TIMEZONES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Currency
            <select name="currency" defaultValue={settings.currency} className={inputClass}>
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
          <label className={labelClass}>
            Tax rate % (optional)
            <input name="taxRate" type="number" step="0.01" min="0" max="100" defaultValue={settings.taxRate} placeholder="0" className={inputClass} />
          </label>
          <label className={labelClass}>
            Tax ID (optional)
            <input name="taxId" defaultValue={settings.taxId} className={inputClass} />
          </label>
        </div>

        <SubmitButton className={saveBtn} pendingText="Saving…">Save changes</SubmitButton>
      </form>

      {/* Business hours */}
      <form action={updateBusinessHoursAction} className={cardClass}>
        <input type="hidden" name="slug" value={settings.slug} />
        <div>
          <h2 className="text-lg font-semibold text-ink">Opening hours</h2>
          <p className="mt-1 text-sm text-muted">Used for scheduling and capacity. Toggle a day closed to block it.</p>
        </div>

        <div className="grid gap-2">
          {settings.hours.map((h) => (
            <div key={h.dayOfWeek} className="grid grid-cols-[110px_auto_1fr] items-center gap-3 rounded-xl border border-line bg-sunken/50 px-3 py-2 max-[560px]:grid-cols-[90px_auto_1fr]">
              <span className="text-sm font-semibold text-ink">{WEEKDAYS[h.dayOfWeek]}</span>
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted">
                <input type="checkbox" name={`day_${h.dayOfWeek}_closed`} defaultChecked={h.isClosed} className="size-4 accent-plum" />
                Closed
              </label>
              <div className="flex items-center justify-end gap-2 text-sm">
                <input type="time" name={`day_${h.dayOfWeek}_open`} defaultValue={h.openTime} className="h-9 rounded-lg border border-line bg-card px-2 text-ink outline-none focus:border-plum" />
                <span className="text-faint">–</span>
                <input type="time" name={`day_${h.dayOfWeek}_close`} defaultValue={h.closeTime} className="h-9 rounded-lg border border-line bg-card px-2 text-ink outline-none focus:border-plum" />
              </div>
            </div>
          ))}
        </div>

        <SubmitButton className={saveBtn} pendingText="Saving…">Save hours</SubmitButton>
      </form>
    </div>
  );
}
