import "server-only";

import { prisma, isDatabaseConfigured } from "@/lib/prisma";

// SMS (Twilio) and WhatsApp (Meta Cloud API) transports, built to mirror
// email.ts exactly: env-gated, dry-run fallback that never throws, and every
// attempt recorded in NotificationLog. No SDK dependencies — plain fetch, like
// the Resend path in email.ts.
//
// These stay dormant (dry-run) until the relevant env vars are set, so the app
// behaves identically to before until an operator activates a channel.

type SendResult = { ok: boolean; dryRun: boolean };

type SendInput = {
  to: string;
  body: string;
  type: string; // NotificationLog.type
  businessId?: string | null;
  customerId?: string | null;
};

/* ---- config (all optional; absence => dry-run) --------------------------- */

function twilioConfig() {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_SMS_FROM?.trim();
  if (!sid || !token || !from) return null;
  return { sid, token, from };
}

function whatsappConfig() {
  const token = process.env.WHATSAPP_BUSINESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneNumberId) return null;
  return { token, phoneNumberId };
}

export function isSmsConfigured() {
  return Boolean(twilioConfig());
}

export function isWhatsappConfigured() {
  return Boolean(whatsappConfig());
}

/* ---- NotificationLog ----------------------------------------------------- */

async function record(
  channel: "SMS" | "WHATSAPP",
  input: SendInput,
  status: "SENT" | "FAILED" | "PENDING",
  sentAt: Date | null,
  meta: Record<string, unknown>,
) {
  if (!input.businessId || !isDatabaseConfigured()) return;
  await prisma.notificationLog
    .create({
      data: {
        businessId: input.businessId,
        customerId: input.customerId ?? null,
        channel,
        type: input.type,
        recipient: input.to,
        status,
        sentAt,
        payload: meta as never,
      },
    })
    .catch(() => {
      /* logging must never break the caller */
    });
}

/* ---- SMS (Twilio) -------------------------------------------------------- */

export async function sendSms(input: SendInput): Promise<SendResult> {
  const cfg = twilioConfig();

  if (!cfg) {
    console.info(`[sms:dry-run] to=${input.to} type=${input.type} (set TWILIO_* to send)`);
    await record("SMS", input, "SENT", new Date(), { dryRun: true, transport: "dry-run" });
    return { ok: true, dryRun: true };
  }

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cfg.sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${cfg.sid}:${cfg.token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: cfg.from, To: input.to, Body: input.body }).toString(),
    });
    const ok = res.ok;
    if (!ok) console.error(`[sms] Twilio responded ${res.status}: ${await res.text().catch(() => "")}`);
    await record("SMS", input, ok ? "SENT" : "FAILED", ok ? new Date() : null, { dryRun: false, transport: "twilio" });
    return { ok, dryRun: false };
  } catch (err) {
    console.error("[sms] Twilio request failed:", err instanceof Error ? err.message : err);
    await record("SMS", input, "FAILED", null, { dryRun: false, transport: "twilio" });
    return { ok: false, dryRun: false };
  }
}

/* ---- WhatsApp (Meta Cloud API) ------------------------------------------- */

/**
 * NOTE ON MARKETING: a business-initiated WhatsApp message to a client outside
 * the 24-hour customer-service window must use a pre-approved message template,
 * not free text. This sends a text message, which is correct for SMS-style use
 * and within-window replies; a cold marketing blast additionally needs an
 * approved template registered with Meta. See docs/MESSAGING.md.
 */
export async function sendWhatsapp(input: SendInput): Promise<SendResult> {
  const cfg = whatsappConfig();

  if (!cfg) {
    console.info(`[whatsapp:dry-run] to=${input.to} type=${input.type} (set WHATSAPP_* to send)`);
    await record("WHATSAPP", input, "SENT", new Date(), { dryRun: true, transport: "dry-run" });
    return { ok: true, dryRun: true };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${cfg.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: input.to,
        type: "text",
        text: { body: input.body },
      }),
    });
    const ok = res.ok;
    if (!ok) console.error(`[whatsapp] Cloud API responded ${res.status}: ${await res.text().catch(() => "")}`);
    await record("WHATSAPP", input, ok ? "SENT" : "FAILED", ok ? new Date() : null, { dryRun: false, transport: "meta" });
    return { ok, dryRun: false };
  } catch (err) {
    console.error("[whatsapp] Cloud API request failed:", err instanceof Error ? err.message : err);
    await record("WHATSAPP", input, "FAILED", null, { dryRun: false, transport: "meta" });
    return { ok: false, dryRun: false };
  }
}

/** True if the given campaign channel can currently deliver (or dry-run). */
export function channelStatus(channel: "EMAIL" | "SMS" | "WHATSAPP") {
  if (channel === "SMS") return { live: isSmsConfigured() };
  if (channel === "WHATSAPP") return { live: isWhatsappConfigured() };
  return { live: true }; // email always has a transport (smtp/resend/dry-run)
}
