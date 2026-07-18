# Messaging channels (SMS + WhatsApp)

Beauty OS can notify clients and send marketing campaigns over three channels:
Email, SMS, and WhatsApp. Each transport is **env-gated** and falls back to a
safe **dry-run** (logged to `NotificationLog`, nothing actually sent) until its
credentials are set — so the app behaves identically to before until an operator
activates a channel. No SDKs; everything is plain `fetch`.

Source: `src/lib/messaging.ts` (SMS/WhatsApp), `src/lib/email.ts` (email).

## SMS — Twilio

Set all three and SMS goes live; leave any unset and it stays dry-run.

| Var | Meaning |
| --- | --- |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_SMS_FROM` | An SMS-capable Twilio number, e.g. `+14155552671` |

## WhatsApp — Meta WhatsApp Cloud API

| Var | Meaning |
| --- | --- |
| `WHATSAPP_BUSINESS_TOKEN` | Cloud API access token (Bearer) |
| `WHATSAPP_PHONE_NUMBER_ID` | The Cloud API phone-number id |

### Important: marketing WhatsApp needs approved templates

A **business-initiated** WhatsApp message to a client outside the 24-hour
customer-service window must use a **pre-approved message template**, not free
text. `sendWhatsapp` currently sends a text message — correct for SMS-style use
and within-window replies, but a cold marketing blast will be rejected by Meta
unless it uses an approved template. Registering templates and switching the
marketing send to a template payload is the remaining step before WhatsApp
marketing is production-real. SMS has no such restriction.

## How sending works

- **Campaigns** (`sendCampaign`): dispatched to clients who have **opted in on
  that channel** (`marketingOptInEmail/Sms/Whatsapp`) and have the relevant
  contact detail. A client opted out of SMS is never texted even if opted in to
  email. A sent campaign becomes read-only (a record of what went out).
- **Every attempt** — real or dry-run — is written to `NotificationLog` with the
  channel, recipient, status, and a `dryRun` flag, so there's always a trail.

## Consent

The three `marketingOptIn*` flags on a client are editable on the client detail
page. Sending respects them per channel. They are consent, not preference —
honour them.
