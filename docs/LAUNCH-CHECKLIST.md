# Beauty OS Launch Checklist

Use this before promoting a build to production.

## Code Gates

- `npm test`
- `npm run lint`
- `npm run build`
- Confirm `git status --short` contains only intended release changes.

## Required Production Environment

Set these in the deployment provider, scoped to production:

- `DATABASE_URL`: restricted application Postgres URL.
- `MIGRATE_DATABASE_URL`: owner Postgres URL used only for migrations/schema pushes.
- `DB_RLS`: `on` only after `prisma/rls.sql` and `prisma/rls-role.sql` have been applied and verified.
- `MFA_SECRET_KEY`: stable 32-byte hex key.
- `APP_URL`: canonical production URL with no trailing slash.
- `OPENAI_API_KEY`: required for full AI assistant responses.
- `OPENAI_MODEL`: defaults to `gpt-5-mini` when unset; set to `gpt-5.1` for stronger answers at roughly 5x the cost.
- Email: either `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` or `RESEND_API_KEY` and `EMAIL_FROM`.
- SMS/WhatsApp, if enabled: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM`, `WHATSAPP_BUSINESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`.
- SSO, if enabled: `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, and optionally `WORKOS_MICROSOFT_ENABLED=true`.
- Sentry, if enabled: `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`.

Never commit real values for these variables.

## Database

- Apply Prisma schema with `DATABASE_URL="$MIGRATE_DATABASE_URL" npm run db:push`.
- Seed only intended starter data with `npm run db:seed`.
- Verify at least one platform admin and one tenant owner can sign in.
- If enabling RLS, apply `prisma/rls.sql`, create/use the restricted role from `prisma/rls-role.sql`, then point production `DATABASE_URL` at that restricted role.
- With `DB_RLS=on`, verify a user from one tenant cannot access another tenant's slug.

## Auth And Trial Gates

- Password sign-in succeeds for platform admin.
- Password sign-in succeeds for tenant owner.
- Unknown or inactive tenant users redirect away from protected tenant routes.
- Unverified users are redirected to `/verify-email`.
- Expired trial workspaces redirect to `/trial-expired`.
- MFA enrollment, challenge, recovery code, and failed-code paths work when `MFA_SECRET_KEY` is set.

## Core Smoke Flows

- Create a client.
- Create an appointment.
- Confirm an appointment and record the deposit.
- Create an invoice from an appointment.
- Create a manual invoice.
- Send an invoice.
- Record invoice payment; overpayment is rejected.
- Refund or void payment from the payment detail page.
- Void an unpaid invoice.
- Add inventory, adjust stock, and confirm movement history.
- Create a campaign/coupon and confirm channel dry-run/live status is clear.
- Open AI Insights and send an assistant message.

## Post-Deploy HTTP Checks

- `/` returns `200`.
- `/login` returns `200`.
- `/manifest.webmanifest` returns `200`.
- A protected tenant route without a session redirects to `/login`.
- A protected tenant route with a valid session renders without server errors.

## Production Monitoring

- Confirm Sentry receives a test event when configured.
- Confirm transactional email logs show live transport, not dry-run.
- Confirm SMS/WhatsApp logs show live transport only after those channels are intended to be live.
- Review CSP report-only events before enforcing CSP.
