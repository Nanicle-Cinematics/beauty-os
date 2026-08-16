export type InvoiceStatus = "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "VOID";

export type InvoiceTotalsInput = {
  subtotal: number;
  discount: number;
  tax: number;
};

export type InvoicePaymentInput = {
  total: number;
  paid: number;
  refunded: number;
  dueDate?: Date | null;
  currentStatus: InvoiceStatus;
  now?: Date;
};

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateInvoiceTotals({ subtotal, discount, tax }: InvoiceTotalsInput) {
  const normalizedSubtotal = Math.max(0, roundMoney(subtotal));
  const normalizedDiscount = Math.max(0, roundMoney(discount));
  const normalizedTax = Math.max(0, roundMoney(tax));
  const total = Math.max(0, roundMoney(normalizedSubtotal - normalizedDiscount + normalizedTax));

  return {
    subtotal: normalizedSubtotal,
    discount: normalizedDiscount,
    tax: normalizedTax,
    total,
  };
}

export function calculateInvoicePaymentState({
  total,
  paid,
  refunded,
  dueDate,
  currentStatus,
  now = new Date(),
}: InvoicePaymentInput) {
  if (currentStatus === "VOID") {
    return { status: "VOID" as const, paidNet: roundMoney(paid - refunded), balanceDue: 0 };
  }

  const paidNet = roundMoney(paid - refunded);
  const balanceDue = Math.max(0, roundMoney(total - paidNet));

  if (balanceDue <= 0 && total > 0) {
    return { status: "PAID" as const, paidNet, balanceDue };
  }

  if (paidNet > 0) {
    return { status: "PARTIALLY_PAID" as const, paidNet, balanceDue };
  }

  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dueDayUtc = dueDate ? Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate()) : null;
  if (currentStatus !== "DRAFT" && dueDayUtc != null && dueDayUtc < todayUtc) {
    return { status: "OVERDUE" as const, paidNet, balanceDue };
  }

  return { status: currentStatus === "DRAFT" ? "DRAFT" as const : "SENT" as const, paidNet, balanceDue };
}
