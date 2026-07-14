import "server-only";

import { prisma, isDatabaseConfigured } from "@/lib/prisma";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function defaultFrom() {
  return process.env.EMAIL_FROM?.trim() || "Beauty OS <onboarding@beautyos.dev>";
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

// Send a transactional email via Resend. When no RESEND_API_KEY is set we
// dry-run (log + record the intent) so dev never sends and never crashes —
// same live-path/fallback shape as the rest of the app. Every attempt is
// recorded in NotificationLog when a business is attached.
export async function sendEmail({ to, subject, html, text, type, businessId }: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const dryRun = !apiKey;

  let status: "SENT" | "FAILED" | "PENDING" = "PENDING";
  let sentAt: Date | null = null;

  if (dryRun) {
    console.info(`[email:dry-run] to=${to} type=${type} subject="${subject}" (set RESEND_API_KEY to send)`);
  } else {
    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: defaultFrom(), to, subject, html, text }),
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
          payload: { subject, dryRun },
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
