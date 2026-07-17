// The single definition of what money means in Beauty OS.
//
// Three concepts that were previously conflated — the dashboard called booked
// value "revenue", deposits were marked paid at booking time, and outstanding
// balance was a counter that only ever went down:
//
//   Booked      what clients committed to      appointment prices  (Appointment)
//   Collected   what actually reached you      payments, less refunds (Payment)
//   Outstanding what is still owed             booked − collected
//
// Appointment records are the source of truth for booked. Payment records are
// the source of truth for collected. Nothing else may claim money moved.
//
// Pure by design (no Prisma import) so the rules are unit-testable. Callers pass
// these where-builders to their own aggregate/groupBy calls.

/**
 * Statuses whose price is real booked business.
 *
 * HOLD is excluded: a hold is provisional and contributes 0 until confirmed
 * (docs/HOLDS.md). CANCELLED and NO_SHOW are excluded: an appointment that never
 * happened was never earned. A cancellation fee is real money and reaches the
 * figures the only legitimate way — as a Payment row.
 */
export const BOOKED_STATUSES = ["CONFIRMED", "COMPLETED"] as const;

/**
 * Payment types that settle a booking. PRODUCT_SALE is deliberately absent:
 * retail is money in the till but was never owed against an appointment, so
 * counting it would wrongly cancel out someone's balance.
 */
export const BOOKING_PAYMENT_TYPES = ["DEPOSIT", "FULL_PAYMENT", "BALANCE"] as const;

export type DateRange = { from?: Date; to?: Date };

function within(range?: DateRange) {
  if (!range || (!range.from && !range.to)) return undefined;
  return {
    ...(range.from ? { gte: range.from } : {}),
    ...(range.to ? { lt: range.to } : {}),
  };
}

/** Appointments whose price counts as booked value. */
export function bookedWhere(businessId: string, range?: DateRange) {
  const startAt = within(range);
  return {
    businessId,
    status: { in: [...BOOKED_STATUSES] },
    ...(startAt ? { startAt } : {}),
  };
}

/** Payments that brought money in. Ranged on `paidAt` — when cash actually moved. */
export function incomingWhere(businessId: string, range?: DateRange) {
  const paidAt = within(range);
  return {
    businessId,
    status: "SUCCESS" as const,
    type: { not: "REFUND" as const },
    ...(paidAt ? { paidAt } : {}),
  };
}

/** Payments that sent money back out. */
export function refundWhere(businessId: string, range?: DateRange) {
  const paidAt = within(range);
  return {
    businessId,
    status: "SUCCESS" as const,
    type: "REFUND" as const,
    ...(paidAt ? { paidAt } : {}),
  };
}

/** Payments that settle appointment bookings (excludes retail and refunds). */
export function bookingPaymentsWhere(businessId: string, range?: DateRange) {
  const paidAt = within(range);
  return {
    businessId,
    status: "SUCCESS" as const,
    type: { in: [...BOOKING_PAYMENT_TYPES] },
    ...(paidAt ? { paidAt } : {}),
  };
}

/**
 * Money actually in hand: what came in, less what went back out.
 *
 * Refunds are *subtracted*, not filtered away. Every previous copy of this rule
 * used `type: { not: "REFUND" }` alone, so refunding a client left the takings
 * untouched.
 */
export function collected(incoming: number, refunded: number) {
  return incoming - refunded;
}

/**
 * What is still owed: booked, less what has actually been paid toward bookings.
 *
 * Clamped at zero — an overpayment means nothing is owed, not that the client
 * owes a negative amount. Tracking the resulting credit is a separate feature;
 * reporting it as negative debt would be worse than not reporting it.
 */
export function outstanding(booked: number, paidTowardBookings: number) {
  return Math.max(0, booked - paidTowardBookings);
}

/**
 * A completed appointment is not cash. Booked and collected move independently:
 * confirming or completing an appointment must never add its price to takings a
 * second time, because it was never added the first time — only a Payment does
 * that. This helper exists to make that rule greppable and testable.
 */
export function settlement(bookedAmount: number, paidAmount: number) {
  return {
    booked: bookedAmount,
    collected: paidAmount,
    outstanding: outstanding(bookedAmount, paidAmount),
    fullySettled: paidAmount >= bookedAmount && bookedAmount > 0,
  };
}
