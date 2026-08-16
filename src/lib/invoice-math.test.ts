import { describe, expect, it } from "vitest";
import { calculateInvoicePaymentState, calculateInvoiceTotals } from "@/lib/invoice-math";

describe("invoice math", () => {
  it("calculates totals from subtotal, discount and tax", () => {
    expect(calculateInvoiceTotals({ subtotal: 500, discount: 50, tax: 25 })).toEqual({
      subtotal: 500,
      discount: 50,
      tax: 25,
      total: 475,
    });
  });

  it("marks a sent invoice partially paid when only some money is collected", () => {
    expect(calculateInvoicePaymentState({
      total: 500,
      paid: 200,
      refunded: 0,
      currentStatus: "SENT",
    })).toMatchObject({ status: "PARTIALLY_PAID", paidNet: 200, balanceDue: 300 });
  });

  it("moves a paid invoice back to partially paid after a refund", () => {
    expect(calculateInvoicePaymentState({
      total: 500,
      paid: 500,
      refunded: 100,
      currentStatus: "PAID",
    })).toMatchObject({ status: "PARTIALLY_PAID", paidNet: 400, balanceDue: 100 });
  });

  it("marks sent unpaid invoices overdue after the due date", () => {
    expect(calculateInvoicePaymentState({
      total: 500,
      paid: 0,
      refunded: 0,
      dueDate: new Date("2026-07-01T00:00:00.000Z"),
      now: new Date("2026-07-18T00:00:00.000Z"),
      currentStatus: "SENT",
    })).toMatchObject({ status: "OVERDUE", balanceDue: 500 });
  });

  it("does not mark an invoice overdue during its due date", () => {
    expect(calculateInvoicePaymentState({
      total: 500,
      paid: 0,
      refunded: 0,
      dueDate: new Date("2026-07-18T00:00:00.000Z"),
      now: new Date("2026-07-18T18:00:00.000Z"),
      currentStatus: "SENT",
    })).toMatchObject({ status: "SENT", balanceDue: 500 });
  });

  it("keeps void invoices out of balances", () => {
    expect(calculateInvoicePaymentState({
      total: 500,
      paid: 0,
      refunded: 0,
      currentStatus: "VOID",
    })).toMatchObject({ status: "VOID", balanceDue: 0 });
  });
});
