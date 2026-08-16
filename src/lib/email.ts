import "server-only";

import nodemailer from "nodemailer";
import { prisma, isDatabaseConfigured } from "@/lib/prisma";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

type SmtpConfig = { host: string; port: number; secure: boolean; user: string; pass: string; from: string };

// SMTP is used when host/user/pass are all set. Port 465 = implicit TLS;
// anything else (e.g. 587) uses STARTTLS, which nodemailer negotiates.
function smtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass) {
    return null;
  }
  const port = Number(process.env.SMTP_PORT) || 587;
  return { host, port, secure: port === 465, user, pass, from: process.env.SMTP_FROM?.trim() || user };
}

function resendKey() {
  return process.env.RESEND_API_KEY?.trim() || null;
}

// Email is deliverable if either transport is configured.
export function isEmailConfigured() {
  return Boolean(smtpConfig()) || Boolean(resendKey());
}

export type SendEmailResult = { ok: boolean; dryRun: boolean };

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  type: string; // NotificationLog.type
  businessId?: string | null;
  customerId?: string | null;
  /** Salon name to show as the sender, over the shared sending address. */
  fromName?: string | null;
  /** Salon's own email so client replies reach them, not the platform. */
  replyTo?: string | null;
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** The bare address inside a "Name <addr>" string, or the string itself. */
function bareAddress(from: string) {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim();
}

/**
 * Build a From header that shows the salon's name over the shared sending
 * address (we don't yet have per-tenant domains). The name is stripped of CR/LF
 * and quotes first — it comes from a business's editable name, so it must never
 * be able to inject extra headers.
 */
export function composeFrom(configuredFrom: string, fromName?: string | null) {
  if (!fromName || !fromName.trim()) return configuredFrom;
  const safeName = fromName.replace(/["\r\n]+/g, " ").trim().slice(0, 78);
  return `"${safeName}" <${bareAddress(configuredFrom)}>`;
}

/** A reply-to only if it's a plausible address. */
export function safeReplyTo(replyTo?: string | null) {
  const v = replyTo?.trim();
  return v && EMAIL_RE.test(v) ? v : undefined;
}

// Send a transactional email. Transport precedence: SMTP (nodemailer) → Resend
// HTTP API → dry-run (log + record intent, never send, never crash). Setting
// SMTP_* vars activates SMTP; remove them and a RESEND_API_KEY takes back over
// — no code change needed. Every attempt is recorded in NotificationLog when a
// business is attached.
export async function sendEmail({ to, subject, html, text, type, businessId, customerId, fromName, replyTo }: SendEmailInput): Promise<SendEmailResult> {
  const smtp = smtpConfig();
  const key = resendKey();
  const reply = safeReplyTo(replyTo);

  let status: "SENT" | "FAILED" | "PENDING" = "PENDING";
  let sentAt: Date | null = null;
  let dryRun = false;
  const transport = smtp ? "smtp" : key ? "resend" : "dry-run";

  if (smtp) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: { user: smtp.user, pass: smtp.pass },
      });
      // Display name = the salon; envelope/address stays the shared sender.
      await transporter.sendMail({ from: composeFrom(smtp.from, fromName), replyTo: reply, to, subject, text, html });
      status = "SENT";
      sentAt = new Date();
    } catch (err) {
      status = "FAILED";
      console.error("[email] SMTP send failed:", err instanceof Error ? err.message : err);
    }
  } else if (key) {
    const from = composeFrom(process.env.EMAIL_FROM?.trim() || "Beauty OS <onboarding@beautyos.dev>", fromName);
    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, subject, html, text, ...(reply ? { reply_to: reply } : {}) }),
      });
      if (res.ok) {
        status = "SENT";
        sentAt = new Date();
      } else {
        status = "FAILED";
        console.error(`[email] Resend responded ${res.status}: ${await res.text().catch(() => "")}`);
      }
    } catch (err) {
      status = "FAILED";
      console.error("[email] Resend request failed:", err);
    }
  } else {
    dryRun = true;
    console.info(`[email:dry-run] to=${to} type=${type} subject="${subject}" (set SMTP_* or RESEND_API_KEY to send)`);
  }

  if (businessId && isDatabaseConfigured()) {
    await prisma.notificationLog
      .create({
        data: {
          businessId,
          customerId: customerId ?? null,
          channel: "EMAIL",
          type,
          recipient: to,
          status,
          sentAt,
          payload: { subject, dryRun, transport },
        },
      })
      .catch(() => {
        /* logging the notification must never break the user-facing action */
      });
  }

  return { ok: status !== "FAILED", dryRun };
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendInviteEmail({
  to,
  name,
  businessName,
  url,
  businessId,
  roleName,
}: {
  to: string;
  name: string;
  businessName: string;
  url: string;
  businessId?: string | null;
  roleName?: string | null;
}): Promise<SendEmailResult> {
  const role = roleName?.trim() || "owner";
  const subject = `Join ${businessName} on Beauty OS`;
  const safeName = escapeHtml(name);
  const safeBusiness = escapeHtml(businessName);
  const safeRole = escapeHtml(role);

  const text = [
    `Hi ${name},`,
    ``,
    `You've been invited to join ${businessName} as ${role} on Beauty OS.`,
    `Set your password and activate your account here:`,
    url,
    ``,
    `This link expires in 7 days. If you weren't expecting this, you can ignore it.`,
  ].join("\n");

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#fafafa;padding:32px">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e7e7ea;border-radius:24px;padding:28px">
      <div style="font-size:11px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:#9d4e7a">Beauty OS</div>
      <h1 style="margin:8px 0 16px;font-size:22px;color:#18181b">Set up your account</h1>
      <p style="margin:0 0 16px;font-size:14px;color:#71717a">
        Hi ${safeName}, you've been invited to join <strong style="color:#18181b">${safeBusiness}</strong>
        as <strong style="color:#18181b">${safeRole}</strong> on Beauty OS.
        Click below to set your password and activate your account.
      </p>
      <a href="${url}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-weight:800;font-size:14px;padding:12px 22px;border-radius:16px">Activate account</a>
      <p style="margin:20px 0 0;font-size:12px;color:#a1a1aa">This link expires in 7 days. If you weren't expecting this, you can ignore it.</p>
    </div>
  </div>`;

  return sendEmail({ to, subject, html, text, type: "owner_invite", businessId });
}

// Shell shared by the client-facing hold emails. Deliberately matches the
// invite/verification templates above rather than the app's plum tokens — every
// email we send should look like the same sender.
function holdEmailShell({ heading, body, businessName }: { heading: string; body: string; businessName: string }) {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#fafafa;padding:32px">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e7e7ea;border-radius:24px;padding:28px">
      <div style="font-size:11px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:#9d4e7a">${escapeHtml(businessName)}</div>
      <h1 style="margin:8px 0 16px;font-size:22px;color:#18181b">${escapeHtml(heading)}</h1>
      <p style="margin:0 0 16px;font-size:14px;color:#71717a;line-height:22px">${body}</p>
      <p style="margin:20px 0 0;font-size:12px;color:#a1a1aa">Sent by ${escapeHtml(businessName)} via Beauty OS.</p>
    </div>
  </div>`;
}

/**
 * The hold ahead of this client fell through, so the date is theirs if they want
 * it. There is no client login, so the call to action is to phone the salon —
 * see "this is staff-only" in docs/HOLDS.md.
 */
export async function sendHoldPromotedEmail({
  to,
  clientName,
  businessName,
  serviceName,
  when,
  businessPhone,
  businessEmail,
  businessId,
  customerId,
}: {
  to: string;
  clientName: string;
  businessName: string;
  serviceName: string;
  when: string;
  businessPhone?: string | null;
  businessEmail?: string | null;
  businessId?: string | null;
  customerId?: string | null;
}): Promise<SendEmailResult> {
  const subject = `${when} just opened up at ${businessName}`;
  const callTo = businessPhone ? `call us on ${businessPhone}` : "reply to this email";

  const text = [
    `Hi ${clientName},`,
    ``,
    `Good news — ${when} has just become available for your ${serviceName}.`,
    `You were next in line, so it's yours if you'd still like it.`,
    ``,
    `To confirm, ${callTo} and we'll lock it in.`,
    ``,
    `— ${businessName}`,
  ].join("\n");

  const html = holdEmailShell({
    businessName,
    heading: "Your date just opened up",
    body: `Hi ${escapeHtml(clientName)}, good news — <strong style="color:#18181b">${escapeHtml(when)}</strong> has just become available for your ${escapeHtml(serviceName)}. You were next in line, so it's yours if you'd still like it.<br><br>To confirm, ${escapeHtml(callTo)} and we'll lock it in.`,
  });

  return sendEmail({ to, subject, html, text, type: "hold_promoted", businessId, customerId, fromName: businessName, replyTo: businessEmail });
}

/** The slot this client was holding went to someone who confirmed first. */
export async function sendHoldReleasedEmail({
  to,
  clientName,
  businessName,
  serviceName,
  when,
  businessEmail,
  businessId,
  customerId,
}: {
  to: string;
  clientName: string;
  businessName: string;
  serviceName: string;
  when: string;
  businessEmail?: string | null;
  businessId?: string | null;
  customerId?: string | null;
}): Promise<SendEmailResult> {
  const subject = `About your held date at ${businessName}`;

  const text = [
    `Hi ${clientName},`,
    ``,
    `We're sorry — ${when} has now been booked, so we've had to release the hold on your ${serviceName}.`,
    ``,
    `Get in touch and we'll find you another time that works.`,
    ``,
    `— ${businessName}`,
  ].join("\n");

  const html = holdEmailShell({
    businessName,
    heading: "Your held date has been booked",
    body: `Hi ${escapeHtml(clientName)}, we're sorry — <strong style="color:#18181b">${escapeHtml(when)}</strong> has now been booked, so we've had to release the hold on your ${escapeHtml(serviceName)}.<br><br>Get in touch and we'll find you another time that works.`,
  });

  return sendEmail({ to, subject, html, text, type: "hold_released", businessId, customerId, fromName: businessName, replyTo: businessEmail });
}

/**
 * A platform admin activated this workspace. Sent from Beauty OS itself (no
 * fromName/replyTo — this is the platform talking to its customer, not a salon
 * talking to a client), and worded from whether the workspace was actually
 * locked: a lapsed trial hears "unlocked", a mid-trial upgrade hears "active".
 */
/**
 * Wording for the activation email. Exported pure so the lapsed-trial vs
 * mid-trial-upgrade branch is testable without sending anything. CRLF is
 * stripped from the business name because it reaches the Subject header and
 * the owner controls it.
 */
export function reactivationCopy(businessName: string, wasLocked: boolean) {
  const safe = businessName.replace(/[\r\n]+/g, " ").trim();
  return {
    subject: wasLocked ? `${safe} is unlocked on Beauty OS` : `${safe} is now on a full Beauty OS plan`,
    heading: wasLocked ? "Your workspace is unlocked" : "Your workspace is now active",
    lead: wasLocked
      ? `Good news — ${safe} is active again and everything is exactly where you left it. Nothing was deleted while it was locked.`
      : `${safe} is now on a full plan, so your workspace stays open with no trial countdown.`,
  };
}

export async function sendWorkspaceReactivatedEmail({
  to,
  name,
  businessName,
  url,
  wasLocked,
  businessId,
}: {
  to: string;
  name: string;
  businessName: string;
  url: string;
  wasLocked: boolean;
  businessId?: string | null;
}): Promise<SendEmailResult> {
  const { subject, heading, lead } = reactivationCopy(businessName, wasLocked);

  const text = [
    `Hi ${name},`,
    ``,
    lead,
    ``,
    `Pick up where you left off:`,
    url,
    ``,
    `— Beauty OS`,
  ].join("\n");

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#fafafa;padding:32px">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e7e7ea;border-radius:24px;padding:28px">
      <div style="font-size:11px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:#9d4e7a">Beauty OS</div>
      <h1 style="margin:8px 0 16px;font-size:22px;color:#18181b">${escapeHtml(heading)}</h1>
      <p style="margin:0 0 16px;font-size:14px;color:#71717a;line-height:22px">
        Hi ${escapeHtml(name)}, ${escapeHtml(lead)}
      </p>
      <a href="${url}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-weight:800;font-size:14px;padding:12px 22px;border-radius:16px">Open ${escapeHtml(businessName)}</a>
      <p style="margin:20px 0 0;font-size:12px;color:#a1a1aa">Any questions, just reply to this email.</p>
    </div>
  </div>`;

  return sendEmail({ to, subject, html, text, type: "workspace_reactivated", businessId });
}

export async function sendVerificationEmail({
  to,
  name,
  url,
  businessId,
}: {
  to: string;
  name: string;
  url: string;
  businessId?: string | null;
}): Promise<SendEmailResult> {
  const subject = "Verify your email for Beauty OS";
  const safeName = escapeHtml(name);

  const text = [
    `Hi ${name},`,
    ``,
    `Confirm your email address to secure your Beauty OS account:`,
    url,
    ``,
    `This link expires in 24 hours. If you didn't sign up, you can ignore this.`,
  ].join("\n");

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#fafafa;padding:32px">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e7e7ea;border-radius:24px;padding:28px">
      <div style="font-size:11px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:#9d4e7a">Beauty OS</div>
      <h1 style="margin:8px 0 16px;font-size:22px;color:#18181b">Verify your email</h1>
      <p style="margin:0 0 16px;font-size:14px;color:#71717a">
        Hi ${safeName}, confirm your email address to secure your account.
      </p>
      <a href="${url}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-weight:800;font-size:14px;padding:12px 22px;border-radius:16px">Verify email</a>
      <p style="margin:20px 0 0;font-size:12px;color:#a1a1aa">This link expires in 24 hours. If you didn't sign up, you can ignore this.</p>
    </div>
  </div>`;

  return sendEmail({ to, subject, html, text, type: "email_verification", businessId });
}
