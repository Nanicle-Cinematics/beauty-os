import { describe, it, expect } from "vitest";
import {
  defaultHoldExpiry,
  holdExpiryLabel,
  isHoldExpired,
  nextHoldPriority,
  promoteLadder,
  ordinal,
  holdQueueLabel,
  DEFAULT_HOLD_DAYS,
} from "@/lib/holds";

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

describe("nextHoldPriority", () => {
  it("starts the queue at 1 when nobody else holds the slot", () => {
    expect(nextHoldPriority([])).toBe(1);
  });

  it("joins the back of the queue", () => {
    expect(nextHoldPriority([1])).toBe(2);
    expect(nextHoldPriority([1, 2, 3])).toBe(4);
  });

  it("reads the high-water mark, so gaps never cause a collision", () => {
    // A middle hold was released without a re-rank: 1 and 3 remain. Counting
    // rows would hand out 3 again and duplicate a position.
    expect(nextHoldPriority([1, 3])).toBe(4);
  });

  it("ignores nulls from holds that predate the ladder", () => {
    expect(nextHoldPriority([null, undefined, 2])).toBe(3);
    expect(nextHoldPriority([null, null])).toBe(1);
  });
});

describe("promoteLadder", () => {
  const queue = [
    { id: "b", holdPriority: 2 },
    { id: "c", holdPriority: 3 },
    { id: "d", holdPriority: 4 },
  ];

  it("moves everyone behind the departed hold up one place", () => {
    expect(promoteLadder(queue, 1)).toEqual([
      { id: "b", priority: 1, becomesFirst: true },
      { id: "c", priority: 2, becomesFirst: false },
      { id: "d", priority: 3, becomesFirst: false },
    ]);
  });

  it("leaves holds ahead of the departure untouched", () => {
    // #3 leaves: #2 is ahead and must not move; only #4 shifts.
    expect(promoteLadder(queue, 3)).toEqual([{ id: "d", priority: 3, becomesFirst: false }]);
  });

  it("marks nobody first when the front of the queue survives", () => {
    expect(promoteLadder(queue, 3).some((p) => p.becomesFirst)).toBe(false);
  });

  it("skips holds with no priority rather than promoting them", () => {
    expect(promoteLadder([{ id: "x", holdPriority: null }], 1)).toEqual([]);
  });
});

describe("ordinal", () => {
  it("handles the common cases", () => {
    expect(["", ordinal(1), ordinal(2), ordinal(3), ordinal(4)].join(" ").trim()).toBe("1st 2nd 3rd 4th");
  });

  it("handles the teens, which break the mod-10 rule", () => {
    expect([ordinal(11), ordinal(12), ordinal(13)].join(" ")).toBe("11th 12th 13th");
    expect([ordinal(21), ordinal(22), ordinal(23)].join(" ")).toBe("21st 22nd 23rd");
  });
});

describe("holdQueueLabel", () => {
  it("describes a place in the queue", () => {
    expect(holdQueueLabel(1)).toBe("1st in line");
    expect(holdQueueLabel(2)).toBe("2nd in line");
  });

  it("returns null when there is no position", () => {
    expect(holdQueueLabel(null)).toBeNull();
    expect(holdQueueLabel(0)).toBeNull();
  });
});
