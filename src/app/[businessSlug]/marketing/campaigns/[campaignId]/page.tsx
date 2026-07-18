import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2, ShieldAlert, Send } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui";
import { getCampaignDetail, getMarketingModuleData } from "@/lib/marketing-data";
import { updateCampaignAction, deleteCampaignAction, sendCampaignAction } from "@/lib/marketing-actions";
import { channelStatus } from "@/lib/messaging";
import { requireTenantAccess } from "@/lib/auth";
import { membershipIn, roleCan } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const STATUSES = [
  { value: "DRAFT", label: "Draft" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "SENT", label: "Sent" },
  { value: "CANCELLED", label: "Cancelled" },
];

type Props = {
  params: Promise<{ businessSlug: string; campaignId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function CampaignDetailPage({ params, searchParams }: Props) {
  const { businessSlug, campaignId } = await params;
  const { error } = await searchParams;
  const user = await requireTenantAccess(businessSlug);

  const [campaign, module, membership] = await Promise.all([
    getCampaignDetail(businessSlug, campaignId),
    getMarketingModuleData(businessSlug),
    membershipIn(user, businessSlug),
  ]);
  if (!campaign || !module) notFound();

  const canEdit = roleCan(membership?.role, "marketing:edit") && campaign.editable;
  const canDelete = roleCan(membership?.role, "marketing:delete") && campaign.status !== "SENT";
  const canSend = roleCan(membership?.role, "marketing:edit") && campaign.editable;
  const channelLive = channelStatus(campaign.channel as "EMAIL" | "SMS" | "WHATSAPP").live;

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-5">
      <PageHeader title={campaign.name} description="Campaign details.">
        <Link href={`/${businessSlug}/marketing`} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-4 py-2 text-sm font-medium text-muted hover:bg-sunken">
          <ArrowLeft size={15} /> Back
        </Link>
      </PageHeader>

      {error ? (
        <div className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">{error}</div>
      ) : null}

      {!campaign.editable ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-sunken px-4 py-3">
          <Badge tone="success">Sent</Badge>
          <span className="text-[13px] font-medium text-muted">This campaign has been sent, so it&apos;s read-only — a record of what went out.</span>
        </div>
      ) : null}

      <form action={updateCampaignAction} className="card grid gap-4 p-5">
        <input type="hidden" name="businessSlug" value={businessSlug} />
        <input type="hidden" name="campaignId" value={campaign.id} />
        <fieldset disabled={!canEdit} className="grid gap-4 disabled:opacity-60">
          <label className="field-label">
            Name
            <input name="name" defaultValue={campaign.name} className="input" required />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="field-label">
              Channel
              <select name="channel" defaultValue={campaign.channel} className="input">
                {module.channels.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
            <label className="field-label">
              Type
              <select name="type" defaultValue={campaign.type} className="input">
                {module.types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            <label className="field-label">
              Status
              <select name="status" defaultValue={campaign.status} className="input">
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
          </div>
          <label className="field-label">
            Send date
            <input name="scheduledAt" type="date" defaultValue={campaign.scheduledAtLocal} className="input" />
          </label>
          <label className="field-label">
            Message
            <textarea name="content" defaultValue={campaign.content} rows={4} className="input" placeholder="What this campaign says to clients." />
          </label>
          {canEdit ? (
            <div className="flex flex-wrap gap-2.5 border-t border-line-2 pt-4">
              <SubmitButton className="rounded-2xl bg-gradient-to-r from-plum to-wine px-5 py-3 text-sm font-semibold text-white" pendingText="Saving…">Save changes</SubmitButton>
              <Link href={`/${businessSlug}/marketing`} className="rounded-2xl border border-line px-5 py-3 text-sm font-semibold text-muted hover:bg-sunken">Cancel</Link>
            </div>
          ) : null}
        </fieldset>
      </form>

      {canSend ? (
        <section className="card p-5">
          <div className="flex items-center gap-2">
            <Send size={15} className="text-plum" />
            <h2 className="text-[15px] font-semibold">Send</h2>
          </div>
          <p className="mt-0.5 text-[12.5px] leading-5 text-muted">
            Sends over {campaign.channel.toLowerCase()} to every client who has opted in on that channel. Once sent,
            the campaign becomes a read-only record.
          </p>
          {!channelLive ? (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-warning/25 bg-warning-soft px-3.5 py-2.5 text-[12.5px] font-medium text-warning">
              <ShieldAlert size={14} className="shrink-0" />
              {campaign.channel} isn&apos;t connected yet, so this runs in test mode — recipients are logged, no real
              messages go out. Add the channel&apos;s credentials to send for real.
            </div>
          ) : null}
          <form action={sendCampaignAction} className="mt-3">
            <input type="hidden" name="businessSlug" value={businessSlug} />
            <input type="hidden" name="campaignId" value={campaign.id} />
            <SubmitButton
              className="inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-plum to-wine px-5 py-3 text-sm font-semibold text-white"
              pendingText="Sending…"
            >
              <Send size={15} /> {channelLive ? "Send campaign" : "Send in test mode"}
            </SubmitButton>
          </form>
        </section>
      ) : null}

      {canDelete ? (
        <section className="card border-danger/15 p-5">
          <h2 className="text-[15px] font-semibold">Danger zone</h2>
          <p className="mt-0.5 text-[12.5px] leading-5 text-muted">Delete this campaign. Sent campaigns can&apos;t be deleted — they&apos;re marketing history.</p>
          <form action={deleteCampaignAction} className="mt-4">
            <input type="hidden" name="businessSlug" value={businessSlug} />
            <input type="hidden" name="campaignId" value={campaign.id} />
            <SubmitButton className="inline-flex items-center gap-1.5 rounded-xl border border-danger/25 bg-danger-soft px-4 py-2.5 text-[13px] font-semibold text-danger hover:bg-danger hover:text-white" pendingText="Deleting…">
              <Trash2 size={14} /> Delete campaign
            </SubmitButton>
          </form>
        </section>
      ) : !roleCan(membership?.role, "marketing:edit") ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-line bg-sunken px-4 py-3 text-[13px] font-medium text-muted">
          <ShieldAlert size={15} className="shrink-0 text-faint" /> Your role can view this campaign but not change it.
        </div>
      ) : null}
    </div>
  );
}
