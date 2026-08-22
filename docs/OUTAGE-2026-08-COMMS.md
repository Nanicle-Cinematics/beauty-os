# Outage comms — August 2026

Drafts for the Neon compute-quota outage. Send from `naniclecinematics@gmail.com`
(SMTP is unaffected — it does not touch Postgres).

Recipients are **not** listed here: the tenant owner addresses live in the
database that is down. Pull them from your own contacts, or from the Neon
console once service resumes.

---

## 1. Beauty OS salon owners (5 tenants)

Send individually rather than as one visible group — these are competing
businesses and their addresses should not be shown to each other. Use BCC if
sending in one go.

**Subject:** Beauty OS is temporarily down — your data is safe

> Hi {name},
>
> I'm writing to let you know that Beauty OS is currently unavailable, and to
> be straight with you about why.
>
> The database service the app runs on has a monthly usage allowance, and a
> misconfiguration on my side meant it was being used continuously instead of
> only when needed. That allowance ran out, so the app cannot load your
> workspace at the moment.
>
> **Nothing has been lost.** Every client, booking, payment and note is exactly
> where you left it. No data has been deleted and none is at risk.
>
> Service resumes on **1 September**, when the allowance resets. I have already
> fixed the underlying cause, so this will not repeat.
>
> I know this is disruptive, especially if you were relying on it this week, and
> I'm sorry. If you need anything urgently — a client's details, a booking you
> had recorded — email me and I will help however I can.
>
> Thank you for your patience.
>
> {your name}
> Beauty OS

### If someone asks for their data before 1 September

Be honest: you cannot export it until the database is reachable again. The
export route works during a lockout but not during this outage, because it too
has to read from Postgres.

---

## 2. Church management system

Same root cause, separate app. Adjust to how you normally address them.

**Subject:** Church system temporarily unavailable until 1 September

> Hi {name},
>
> The church management system is temporarily unable to load its records. The
> database service it uses has a monthly allowance, and a setting on my side was
> keeping it running around the clock rather than only when in use, which used
> the allowance up early.
>
> All records are safe and nothing has been deleted. The system comes back on
> **1 September** when the allowance resets, and I have already corrected the
> setting that caused it.
>
> Apologies for the disruption — please let me know if anything is urgent in the
> meantime.
>
> {your name}

---

## Notes for the follow-up, once service is back

- Confirm to both audiences that service has resumed. A silent return leaves
  people unsure whether to trust it.
- Do not promise "this can never happen again" — promise the specific cause is
  fixed, which is true and checkable.
- Beauty OS shows a maintenance page in the meantime, so anyone who visits sees
  the same message rather than an error.
