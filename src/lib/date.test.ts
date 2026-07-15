import { describe, it, expect } from "vitest";
import { format, formatTimeInTz, daysBetween, zonedDayRange } from "@/lib/date";

describe("format (UTC HH:mm)", () => {
  it("renders 24h time in UTC", () => {
    expect(format(new Date("2026-07-15T09:05:00Z"))).toBe("09:05");
    expect(format(new Date("2026-07-15T23:59:00Z"))).toBe("23:59");
  });
});

describe("formatTimeInTz", () => {
  it("renders local time in the given zone", () => {
    expect(formatTimeInTz(new Date("2026-07-15T14:30:00Z"), "UTC")).toBe("14:30");
    // Africa/Accra is UTC+0 year-round
    expect(formatTimeInTz(new Date("2026-07-15T14:30:00Z"), "Africa/Accra")).toBe("14:30");
    // New York is UTC-4 in July (EDT)
    expect(formatTimeInTz(new Date("2026-07-15T14:30:00Z"), "America/New_York")).toBe("10:30");
  });
});

describe("daysBetween", () => {
  it("counts whole days between two instants", () => {
    expect(daysBetween(new Date("2026-07-01T00:00:00Z"), new Date("2026-07-15T00:00:00Z"))).toBe(14);
    expect(daysBetween(new Date("2026-07-15T00:00:00Z"), new Date("2026-07-15T23:00:00Z"))).toBe(0);
  });
});

describe("zonedDayRange", () => {
  it("bounds the local calendar day for a zero-offset zone", () => {
    const { start, end } = zonedDayRange(new Date("2026-07-15T10:00:00Z"), "UTC");
    expect(start.toISOString()).toBe("2026-07-15T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-16T00:00:00.000Z");
  });

  it("accounts for a negative UTC offset (late-night rolls to the prior local day)", () => {
    // 02:00Z on Jul 15 is 22:00 EDT on Jul 14 -> local day is Jul 14
    const { start } = zonedDayRange(new Date("2026-07-15T02:00:00Z"), "America/New_York");
    expect(start.toISOString()).toBe("2026-07-14T04:00:00.000Z"); // midnight EDT = 04:00Z
  });
});
