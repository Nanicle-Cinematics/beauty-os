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
};

// Send a transactional email. Transport precedence: SMTP (nodemailer) → Resend
// HTTP API → dry-run (log + record intent, never send, never crash). Setting
// SMTP_* vars activates SMTP; remove them and a RESEND_API_KEY takes back over
// — no code change needed. Every attempt is recorded in NotificationLog when a
// business is attached.
export async function sendEmail({ to, subject, html, text, type, businessId }: SendEmailInput): Promise<SendEmailResult> {
  const smtp = smtpConfig();
  const key = resendKey();

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
      await transporter.sendMail({ from: smtp.from, to, subject, text, html });
      status = "SENT";
      sentAt = new Date();
    } catch (err) {
      status = "FAILED";
      console.error("[email] SMTP send failed:", err instanceof Error ? err.message : err);
    }
  } else if (key) {
    const from = process.env.EMAIL_FROM?.trim() || "Beauty OS <onboarding@beautyos.dev>";
    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, subject, html, text }),
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

function escapeHtml(value: string) {
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
}: {
  to: string;
  name: string;
  businessName: string;
  url: string;
  businessId?: string | null;
}): Promise<SendEmailResult> {
  const subject = `Set up ${businessName} on Beauty OS`;
  const safeName = escapeHtml(name);
  const safeBusiness = escapeHtml(businessName);

  const text = [
    `Hi ${name},`,
    ``,
    `You've been invited to run ${businessName} on Beauty OS.`,
    `Set your password and activate your account here:`,
    url,
    ``,
    `This link expires in 7 days. If you weren't expecting this, you can ignore it.`,
  ].join("\n");

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f6f8f6;padding:32px">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #dbe4de;border-radius:24px;padding:28px">
      <div style="font-size:11px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:#1d7b5d">Beauty OS</div>
      <h1 style="margin:8px 0 16px;font-size:22px;color:#111b17">Set up your account</h1>
      <p style="margin:0 0 16px;font-size:14px;color:#6b7c73">
        Hi ${safeName}, you've been invited to run <strong style="color:#111b17">${safeBusiness}</strong> on Beauty OS.
        Click below to set your password and activate your account.
      </p>
      <a href="${url}" style="display:inline-block;background:#10261f;color:#ffffff;text-decoration:none;font-weight:800;font-size:14px;padding:12px 22px;border-radius:16px">Activate account</a>
      <p style="margin:20px 0 0;font-size:12px;color:#8a978f">This link expires in 7 days. If you weren't expecting this, you can ignore it.</p>
    </div>
  </div>`;

  return sendEmail({ to, subject, html, text, type: "owner_invite", businessId });
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
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f6f8f6;padding:32px">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #dbe4de;border-radius:24px;padding:28px">
      <div style="font-size:11px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:#1d7b5d">Beauty OS</div>
      <h1 style="margin:8px 0 16px;font-size:22px;color:#111b17">Verify your email</h1>
      <p style="margin:0 0 16px;font-size:14px;color:#6b7c73">
        Hi ${safeName}, confirm your email address to secure your account.
      </p>
      <a href="${url}" style="display:inline-block;background:#10261f;color:#ffffff;text-decoration:none;font-weight:800;font-size:14px;padding:12px 22px;border-radius:16px">Verify email</a>
      <p style="margin:20px 0 0;font-size:12px;color:#8a978f">This link expires in 24 hours. If you didn't sign up, you can ignore this.</p>
    </div>
  </div>`;

  return sendEmail({ to, subject, html, text, type: "email_verification", businessId });
}
