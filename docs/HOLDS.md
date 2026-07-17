# Holds (provisional bookings)

A **hold** is a date reserved without commitment: "can you keep June 14 for me?"
The client has not paid, has not confirmed, and may vanish. Today the only way to
record that is to create a `CONFIRMED` appointment (which lies to every revenue
number) or a `PENDING` one (which is indistinguishable from a booking awaiting
confirmation).

Holds make the calendar honest: the date is visibly taken, but nothing about it
counts as business until someone firms it.

## Vocabulary

The film/TV industry calls this a **pencil** ("first pencil", "second pencil",
"dropped"). We keep the mechanic and drop the jargon — the UI says **hold**, and
the queue reads **"1st in line" / "2nd in line"**. A bride in Accra does not know
what a pencil is.

## Data model

```prisma
enum AppointmentStatus {
  HOLD        // provisional — reserved, not committed
  PENDING
  CONFIRMED
  COMPLETED
  CANCELLED
  NO_SHOW
  RESCHEDULED
}

model Appointment {
  holdPriority  Int?       // 1 = first in line, 2 = second… null unless status = HOLD
  holdExpiresAt DateTime?  // past this, the hold is dead (see "Expiry")

  @@index([businessId, staffMemberId, startAt, endAt])  // overlap lookups
}
```

`holdPriority` ranks **within a contended slot**, not globally. The ladder is
implicit: among `HOLD` rows overlapping a given time range for a given staff
member, order by `holdPriority`. A new hold takes `max(overlapping priorities) + 1`.

Note that "overlapping" is not transitive — A(10–12) overlaps B(11–13), and B
overlaps C(12:30–14), but A and C never contend. So priority is a **local**
ranking, best-effort by design, and only ever recomputed against the holds that
actually overlap the one being moved. This is right for the real case (several
clients wanting the same slot) and harmless for pathological chains.

New positions use the **high-water mark** (`max + 1`), not a row count: after a
middle hold is released without a re-rank, counting would re-issue an existing
position and collide.

## ⚠️ The denylist hazard

**Read this before touching any query that filters `AppointmentStatus`.**

Adding `HOLD` is a one-line schema change that silently rewrites the meaning of
every status filter written as a *denylist*. Status filters in this codebase come
in two families:

**Allowlists** — `status: { in: ["COMPLETED", "CONFIRMED"] }`. These are **safe**.
A hold is not realised, so it is excluded automatically and correctly, with no
edit. Found in `reports-data.ts`, `staff-data.ts`, `ai-insights-data.ts`,
`client-data.ts`, `dashboard-data.ts`.

**Denylists** — `status: { notIn: ["CANCELLED", "NO_SHOW"] }`. These are **wrong
the moment `HOLD` exists**, because a hold falls through as if it were a real
booking. Every one of these had to gain `"HOLD"`:

| Site | Was | Broke |
| --- | --- | --- |
| `dashboard-data.ts` `liveToday` | `!CANCELLED.has(status)` | **Penciled dates counted as today's revenue** — plus phantom deposits due and a wrong "next up" |
| `dashboard-data.ts` retention groupBy | `notIn: ["CANCELLED","NO_SHOW"]` | A hold counted as a visit, so one-time clients looked like repeats |
| `payment-data.ts` deposits due | `notIn: ["CANCELLED","NO_SHOW"]` | Holds listed as deposits to collect |

**Rule of thumb: prefer allowlists.** State what counts, not what doesn't. A
denylist silently absorbs every future enum value; an allowlist rejects it.

The same class of bug bit `toneForStatus` once before — `\bout\b` matching
"Outstanding" — and is why the hold branch there is word-boundaried.

## Lifecycle

```
  create ──> HOLD ──confirm──> CONFIRMED ──> COMPLETED
               │                   └─> rival holds on the slot are released
               │                       (cancelReason: "Slot booked by another
               │                        client") and each client is emailed
               │
               ├──release──> CANCELLED (cancelReason: "Hold released")
               │                └─> holds behind it move up one; whoever
               │                    reaches 1st is emailed "your date opened up"
               │
               └──expire───> (treated as released; see below)
```

**Only the client who reaches the front is emailed.** Being told you moved from
4th to 3rd is noise — the front of the queue is the only position that means
"you can actually have this date now".

Emails are sent **after** the transaction commits, never inside it: an SMTP
round-trip must not hold a database transaction open. They're best-effort — a
client with no email on file is skipped, and `sendEmail` already swallows and
logs transport failures. Losing a courtesy note must never fail the staff
member's action. They're transactional, so marketing opt-ins don't gate them.

Because confirming a hold silently cancels other people's holds *and* emails
them, the toast says so explicitly ("Hold confirmed — 2 other holds released and
notified") rather than letting it happen invisibly.

**Release maps to `CANCELLED`, not a new `RELEASED` status.** Deliberate: released
holds then flow through every existing exclusion path with zero further denylist
edits. One new enum value, not two. `cancelReason` distinguishes them for anyone
who needs to.

**Firming** checks that no `CONFIRMED` appointment overlaps that staff member's
slot, and refuses if one does. Before this feature, `createAppointment` had **no
overlap detection whatsoever** — nothing prevented a double-booking. Interval
overlap is `existing.startAt < new.endAt AND existing.endAt > new.startAt`.

## Expiry

Expiry is **lazy, not cron**. There is no sweep job and none is needed for
correctness:

- **Analytics** exclude *all* holds regardless of expiry, so a stale hold can
  never distort a number.
- **Display** compares `holdExpiresAt` to now at read time and marks the hold
  expired. Reads are already `force-dynamic`, so this cannot drift.

Staff may still firm an expired hold — expiry is a signal, not a lock. Being
user-hostile about a soft reservation helps nobody.

A cron only becomes necessary for the *proactive* nudge ("your hold expires
tomorrow") in Phase 3.

## Phasing

**Phase 1 — the safe core. ✅ DONE** (`796fb3a`). Denylist audit, schema, overlap
detection, create-as-hold, firm/release, badge + expiry display.

**Phase 2 — the ladder. ✅ DONE.** `holdPriority` assigned on create,
auto-release of rivals when a hold is confirmed, auto-promote when a hold is
released, and client emails (`hold_promoted` / `hold_released`) through the
existing `sendEmail` / `NotificationLog` path. `sendEmail` gained a `customerId`
so notifications finally populate `NotificationLog.customerId`, which the column
always had and nothing wrote.

**Phase 3 — expiry nudges.** An AI Insights card for holds expiring this week,
then optionally a Vercel Cron for the outbound reminder. Not started.

## Scope: this is staff-only

No phase gives a client entry to the system. Every `[businessSlug]/*` route sits
behind `requireTenantAccess`; there is no public booking surface. Phase 2's
"notify the promoted client" is **one-way outbound email** — the client phones the
salon and staff firms the hold.

Two fields look like a client portal but are inert: `BookingSource.ONLINE` is the
schema default yet nothing writes it (`createAppointment` hardcodes `ADMIN`), and
`Customer.userId` is a nullable FK to `User` that no code reads.

A real client portal is a separate project, and the cost is not the booking UI —
it is that tenancy assumes **authed user = staff of this tenant**.
`requireTenantAccess` resolves membership through `StaffMember`, and that is what
pins the RLS `app.business_id` GUC. A client has no `StaffMember` row, so they
would need a new auth path *and* a new tenant-context path through the most
security-critical code in the app. See `docs/RLS.md`.

## Open questions

- **Should firming require the deposit?** The strongest anti-flake design is that
  holding is free but firming demands the deposit — that is what turns holds into
  money rather than tidier uncertainty. `depositAmount` / `depositPaid` already
  exist for it.
- **Should a business configure a default hold window** (e.g. 7 days) in business
  settings, instead of staff picking an expiry per hold?
