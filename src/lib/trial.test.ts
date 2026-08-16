import { describe, expect, it } from "vitest";
import {
  TRIAL_DAYS,
  daysUntilTrialEnd,
  isOnTrial,
  isTrialExpired,
  resolveTrialEnd,
  trialEndsAt,
} from "@/lib/trial";

describe("trial policy", () => {
  it("ends every trial exactly 7 days after start", () => {
    const start = new Date("2026-07-19T00:00:00.000Z");
    expect(TRIAL_DAYS).toBe(7);
    expect(trialEndsAt(start).toISOString()).toBe("2026-07-26T00:00:00.000Z");
  });

  it("locks trial workspaces at the 7-day boundary", () => {
    const createdAt = new Date("2026-07-19T00:00:00.000Z");

    expect(isTrialExpired({
      businessStatus: "TRIAL",
      businessCreatedAt: createdAt,
      now: new Date("2026-07-25T23:59:59.999Z"),
    })).toBe(false);

    expect(isTrialExpired({
      businessStatus: "TRIAL",
      businessCreatedAt: createdAt,
      now: new Date("2026-07-26T00:00:00.000Z"),
    })).toBe(true);
  });

  it("does not lock active paid workspaces", () => {
    expect(isTrialExpired({
      businessStatus: "ACTIVE",
      businessCreatedAt: new Date("2026-01-01T00:00:00.000Z"),
      subscriptionStatus: "ACTIVE",
      now: new Date("2026-07-19T00:00:00.000Z"),
    })).toBe(false);
  });

  // A plan change leaves a TRIALING subscription behind. That stale row used to
  // outrank an admin marking the business ACTIVE, so the workspace stayed
  // locked and no control in the platform UI could release it.
  it("does not lock an activated business carrying a stale trialing subscription", () => {
    expect(isTrialExpired({
      businessStatus: "ACTIVE",
      businessCreatedAt: new Date("2026-07-16T00:00:00.000Z"),
      subscriptionStatus: "TRIALING",
      subscriptionTrialEndsAt: new Date("2026-07-26T00:00:00.000Z"),
      now: new Date("2026-08-16T00:00:00.000Z"),
    })).toBe(false);
  });

  it("does not lock a paying subscriber whose business row still reads TRIAL", () => {
    expect(isTrialExpired({
      businessStatus: "TRIAL",
      businessCreatedAt: new Date("2026-07-16T00:00:00.000Z"),
      subscriptionStatus: "ACTIVE",
      now: new Date("2026-08-16T00:00:00.000Z"),
    })).toBe(false);
  });

  it("still locks a lapsed trial that was never activated", () => {
    expect(isTrialExpired({
      businessStatus: "TRIAL",
      businessCreatedAt: new Date("2026-07-16T00:00:00.000Z"),
      subscriptionStatus: "TRIALING",
      subscriptionTrialEndsAt: new Date("2026-07-26T00:00:00.000Z"),
      now: new Date("2026-08-16T00:00:00.000Z"),
    })).toBe(true);
  });

  it("prefers the subscription trial end over the created-at fallback", () => {
    // Extending trialEndsAt is the other way to release a locked workspace.
    expect(isTrialExpired({
      businessStatus: "TRIAL",
      businessCreatedAt: new Date("2026-07-16T00:00:00.000Z"),
      subscriptionStatus: "TRIALING",
      subscriptionTrialEndsAt: new Date("2026-09-01T00:00:00.000Z"),
      now: new Date("2026-08-16T00:00:00.000Z"),
    })).toBe(false);
  });
});

describe("resolveTrialEnd", () => {
  it("prefers the subscription's own end date", () => {
    expect(resolveTrialEnd({
      businessCreatedAt: new Date("2026-07-16T00:00:00.000Z"),
      subscriptionTrialEndsAt: new Date("2026-09-01T00:00:00.000Z"),
    }).toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("falls back to seven days from signup with no subscription row", () => {
    expect(resolveTrialEnd({
      businessCreatedAt: new Date("2026-07-16T00:00:00.000Z"),
      subscriptionTrialEndsAt: null,
    }).toISOString()).toBe("2026-07-23T00:00:00.000Z");
  });

  // The gate and the warning must agree on the date, or we warn people about
  // the wrong day — or lock them having never warned them at all.
  it("agrees with the lock gate on exactly when a trial runs out", () => {
    const businessCreatedAt = new Date("2026-07-16T00:00:00.000Z");
    const endsAt = resolveTrialEnd({ businessCreatedAt, subscriptionTrialEndsAt: null });
    const justBefore = new Date(endsAt.getTime() - 1);

    expect(isTrialExpired({ businessStatus: "TRIAL", businessCreatedAt, now: justBefore })).toBe(false);
    expect(isTrialExpired({ businessStatus: "TRIAL", businessCreatedAt, now: endsAt })).toBe(true);
  });
});

describe("isOnTrial", () => {
  it("is false once either side is explicitly activated", () => {
    expect(isOnTrial({ businessStatus: "ACTIVE", subscriptionStatus: "TRIALING" })).toBe(false);
    expect(isOnTrial({ businessStatus: "TRIAL", subscriptionStatus: "ACTIVE" })).toBe(false);
  });

  it("is true for a plain trial, with or without a subscription", () => {
    expect(isOnTrial({ businessStatus: "TRIAL", subscriptionStatus: null })).toBe(true);
    expect(isOnTrial({ businessStatus: "TRIAL", subscriptionStatus: "TRIALING" })).toBe(true);
  });

  it("is false for a closed workspace that was never on a trial", () => {
    expect(isOnTrial({ businessStatus: "CLOSED", subscriptionStatus: null })).toBe(false);
  });
});

describe("daysUntilTrialEnd", () => {
  it("rounds part-days up, so 36 hours left reads as 2 days", () => {
    const now = new Date("2026-08-16T00:00:00.000Z");
    expect(daysUntilTrialEnd(new Date("2026-08-17T12:00:00.000Z"), now)).toBe(2);
  });

  it("reads as 1 day when the trial ends inside the next 24 hours", () => {
    const now = new Date("2026-08-16T00:00:00.000Z");
    expect(daysUntilTrialEnd(new Date("2026-08-16T20:00:00.000Z"), now)).toBe(1);
  });

  it("never goes negative once the trial has passed", () => {
    const now = new Date("2026-08-16T00:00:00.000Z");
    expect(daysUntilTrialEnd(new Date("2026-08-10T00:00:00.000Z"), now)).toBe(0);
  });
});
