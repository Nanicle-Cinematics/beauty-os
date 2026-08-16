import { describe, expect, it } from "vitest";
import { TRIAL_DAYS, isTrialExpired, trialEndsAt } from "@/lib/trial";

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
