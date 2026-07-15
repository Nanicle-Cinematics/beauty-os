# Data handling overview

A plain-language summary of what Beauty OS stores, where, and how it's
protected. This is operational documentation for vendor/security reviews, not a
legal privacy policy.

## What we store

Per business (tenant):

- **Business profile** — name, category, contact, currency, timezone, plan.
- **Team** — staff members, roles, commission settings.
- **Clients (CRM)** — names, contact details, visit history, spend, tags, and
  optional skin/allergy notes entered by staff.
- **Operations** — appointments, services, inventory/products, suppliers,
  stock movements.
- **Money** — payments, deposits, invoices, expenses.
- **Marketing** — campaigns, coupons, loyalty tiers/points.
- **Audit** — a log of key administrative actions.

Per user (identity): email, name, optional phone, scrypt password hash,
optional encrypted TOTP secret + hashed recovery codes, session records.

## Where it's stored

- **Database** — Neon (managed PostgreSQL) in AWS **eu-central-1 (Frankfurt)**.
  A single multi-tenant database isolated by PostgreSQL Row-Level Security.
- **Hosting** — Vercel (serverless functions + global edge for static assets).
- **Error monitoring** — Sentry (EU data region).
- **Transactional email** — SMTP (Gmail) / Resend for invites and verification.

All data in transit is TLS-encrypted. Neon encrypts data at rest.

## Subprocessors

| Provider | Purpose | Region |
|---|---|---|
| Neon | Database | EU (Frankfurt) |
| Vercel | Application hosting | Global edge / US control plane |
| Sentry | Error monitoring | EU |
| Google (Gmail SMTP) / Resend | Transactional email | US |

## Security measures

- Row-Level Security tenant isolation (defense-in-depth beyond app checks).
- scrypt password hashing; AES-256-GCM encryption of MFA secrets at rest.
- Optional TOTP two-factor authentication with single-use recovery codes.
- HTTPS + HSTS; `HttpOnly` / `Secure` / `SameSite` session cookies.
- Security headers (X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy,
  and a Content-Security-Policy).
- Rate limiting on public signup/verification endpoints.

## Retention & deletion

- Data is retained while the workspace is active.
- Deleting a business permanently removes all of its tenant-scoped data
  (customers, appointments, payments, etc.) via database cascade; a user left
  with no remaining membership is removed so the email is freed.
- **Data export**: a workspace's data can be exported as JSON from the app
  (data-subject portability).

## Retention responsibilities

Businesses using Beauty OS are the data controllers for their clients' personal
data; Beauty OS (Nanicle Enterprise Solutions) is the processor.
