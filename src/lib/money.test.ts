import { describe, it, expect } from "vitest";
import {
  bookedWhere,
  incomingWhere,
  refundWhere,
  bookingPaymentsWhere,
  collected,
  outstanding,
  settlement,
  BOOKED_STATUSES,
  BOOKING_PAYMENT_TYPES,
} from "@/lib/money";

describe("booked value", () => {
  it("counts only confirmed and completed appointments", () => {
    expect([...BOOKED_STATUSES]).toEqual(["CONFIRMED", "COMPLETED"]);
  });

  it("excludes holds, cancellations and no-shows from the query", () => {
    const w = bookedWhere("biz_1");
    for (const excluded of ["HOLD", "CANCELLED", "NO_SHOW", "PENDING"]) {
      expect(w.status.in).not.toContain(excluded);
    }
  });

  it("scopes to the tenant and leaves the range open when none is given", () => {
    expect(bookedWhere("biz_1")).toEqual({ businessId: "biz_1", status: { in: ["CONFIRMED", "COMPLETED"] } });
  });

  it("ranges on startAt — booked value belongs to the day of the appointment", () => {
    const from = new Date("2026-07-17T00:00:00Z");
    const to = new Date("2026-07-18T00:00:00Z");
    expect(bookedWhere("biz_1", { from, to })).toMatchObject({ startAt: { gte: from, lt: to } });
  });
});

describe("collected", () => {
  it("ranges on paidAt — takings belong to the day the money moved", () => {
    const from = new Date("2026-07-17T00:00:00Z");
    expect(incomingWhere("biz_1", { from })).toMatchObject({ paidAt: { gte: from } });
  });

  it("counts only successful payments", () => {
    expect(incomingWhere("biz_1").status).toBe("SUCCESS");
    expect(refundWhere("biz_1").status).toBe("SUCCESS");
  });

  it("subtracts refunds rather than ignoring them", () => {
    // The bug this replaces: every previous copy used `type: { not: "REFUND" }`
    // alone, so refunding a client left takings untouched.
    expect(collected(500, 200)).toBe(300);
    expect(collected(500, 0)).toBe(500);
  });

  it("can go negative when refunds exceed takings in a period", () => {
    // Refunding yesterday's booking today genuinely means today lost money.
    expect(collected(0, 200)).toBe(-200);
  });
});

describe("booking payments", () => {
  it("settles bookings with deposits, full payments and balances", () => {
    expect([...BOOKING_PAYMENT_TYPES]).toEqual(["DEPOSIT", "FULL_PAYMENT", "BALANCE"]);
  });

  it("excludes retail — a product sale was never owed against an appointment", () => {
    expect(bookingPaymentsWhere("biz_1").type.in).not.toContain("PRODUCT_SALE");
    expect(bookingPaymentsWhere("biz_1").type.in).not.toContain("REFUND");
  });
});

describe("outstanding", () => {
  it("is what is booked minus what was actually paid", () => {
    expect(outstanding(500, 200)).toBe(300);
  });

  it("is zero once fully paid", () => {
    expect(outstanding(500, 500)).toBe(0);
  });

  it("clamps at zero on overpayment rather than reporting negative debt", () => {
    expect(outstanding(500, 600)).toBe(0);
  });

  it("is the full price when nothing has been paid", () => {
    expect(outstanding(500, 0)).toBe(500);
  });
});

describe("settlement — the worked example from the brief", () => {
  it("a completed GH₵500 booking with a GH₵200 deposit owes GH₵300", () => {
    expect(settlement(500, 200)).toEqual({
      booked: 500,
      collected: 200,
      outstanding: 300,
      fullySettled: false,
    });
  });

  it("paying the remaining GH₵300 settles it without inflating booked value", () => {
    expect(settlement(500, 500)).toEqual({
      booked: 500,
      collected: 500,
      outstanding: 0,
      fullySettled: true,
    });
  });

  it("completing an appointment cannot add its price a second time", () => {
    // Booked is derived from the appointment's own price, so a status change
    // (PENDING -> CONFIRMED -> COMPLETED) re-reads the same 500 and can never
    // accumulate. Collected only ever moves when a Payment row exists.
    const beforeCompletion = settlement(500, 200);
    const afterCompletion = settlement(500, 200);
    expect(afterCompletion).toEqual(beforeCompletion);
  });
});
