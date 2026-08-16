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
});
