import { describe, it, expect } from "vitest";
import { defaultHoldExpiry, holdExpiryLabel, isHoldExpired, DEFAULT_HOLD_DAYS } from "@/lib/holds";

const now = new Date("2026-07-17T12:00:00Z");
const days = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

describe("defaultHoldExpiry", () => {
  it("defaults to a week out for a distant appointment", () => {
    expect(defaultHoldExpiry(days(60), now)).toEqual(days(DEFAULT_HOLD_DAYS));
  });

  it("never outlives the appointment it reserves", () => {
    const soon = days(2);
    expect(defaultHoldExpiry(soon, now)).toEqual(soon);
  });

  it("caps at the appointment even when it is already in the past", () => {
    const past = days(-3);
    expect(defaultHoldExpiry(past, now)).toEqual(past);
  });
});

describe("holdExpiryLabel", () => {
  it("returns null when there is no expiry", () => {
    expect(holdExpiryLabel(null, now)).toBeNull();
    expect(holdExpiryLabel(undefined, now)).toBeNull();
  });

  it("counts whole days remaining", () => {
    expect(holdExpiryLabel(days(3), now)).toBe("expires in 3 days");
    expect(holdExpiryLabel(days(7), now)).toBe("expires in 7 days");
  });

  it("singularises a single day", () => {
    expect(holdExpiryLabel(days(1), now)).toBe("expires in 1 day");
  });

  it("reads as today when the expiry lands later the same day", () => {
    expect(holdExpiryLabel(new Date(now.getTime() + 60 * 60 * 1000), now)).toBe("expires today");
  });

  // The date picker submits UTC midnight, so a date N days out is N-0.5 days
  // away. Dividing elapsed ms would report N-1. Only fractional offsets expose
  // this — every whole-day case above passes either way.
  it("counts calendar days, not elapsed 24h blocks", () => {
    const threeDaysOut = new Date("2026-07-20T00:00:00Z"); // now = 17th 12:00Z
    expect(holdExpiryLabel(threeDaysOut, now)).toBe("expires in 3 days");
  });

  it("calls midnight tomorrow one day, not two", () => {
    expect(holdExpiryLabel(new Date("2026-07-18T00:00:00Z"), now)).toBe("expires in 1 day");
  });

  it("reports a lapsed hold as expired", () => {
    expect(holdExpiryLabel(days(-1), now)).toBe("expired");
    expect(holdExpiryLabel(now, now)).toBe("expired");
  });
});

describe("isHoldExpired", () => {
  it("is false without an expiry, or while time remains", () => {
    expect(isHoldExpired(null, now)).toBe(false);
    expect(isHoldExpired(days(1), now)).toBe(false);
  });

  it("is true at or past the expiry instant", () => {
    expect(isHoldExpired(now, now)).toBe(true);
    expect(isHoldExpired(days(-1), now)).toBe(true);
  });
});
