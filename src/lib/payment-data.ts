import "server-only";

import { prisma, tenantTransaction, isDatabaseConfigured } from "@/lib/prisma";
import { findOrCreateCustomer } from "@/lib/entity-resolve";
import { bookedWhere, bookingPaymentsWhere, incomingWhere, refundWhere, collected, outstanding, depositDue } from "@/lib/money";

export type PaymentRow = {
  id: string;
  client: string;
  method: string;
  type: string;
  amount: string;
  isRefund: boolean;
  status: string;
  statusKey: string;
  when: string;
};

export type DepositDue = {
  appointmentId: string;
  customerId: string;
  client: string;
  service: string;
  amount: string;
  amountRaw: number;
  when: string;
};

export type PaymentStat = { label: string; value: string; detail: string };
export type PaymentOption = { id: string; label: string };

export type PaymentModuleData = {
  tenant: { id: string; name: string; slug: string; currency: string };
  stats: PaymentStat[];
  payments: PaymentRow[];
  depositsDue: DepositDue[];
  customers: PaymentOption[];
  appointments: PaymentOption[];
  methods: { value: string; label: string }[];
  types: { value: string; label: string }[];
};

export const PAYMENT_METHODS = [
  { value: "PAYSTACK", label: "Paystack" },
  { value: "HUBTEL", label: "Hubtel" },
  { value: "MOMO", label: "MTN MoMo" },
  { value: "TELECEL_CASH", label: "Telecel Cash" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CASH", label: "Cash" },
];

export const PAYMENT_TYPES = [
  { value: "DEPOSIT", label: "Deposit" },
  { value: "FULL_PAYMENT", label: "Full payment" },
  { value: "BALANCE", label: "Balance" },
  { value: "PRODUCT_SALE", label: "Product sale" },
  { value: "REFUND", label: "Refund" },
];

const METHOD_LABELS = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, m.label]));
const TYPE_LABELS = Object.fromEntries(PAYMENT_TYPES.map((t) => [t.value, t.label]));
const VALID_METHODS = new Set(PAYMENT_METHODS.map((m) => m.value));
const VALID_TYPES = new Set(PAYMENT_TYPES.map((t) => t.value));

function currencySymbol(currency: string) {
  return currency === "GHS" ? "GH₵" : currency;
}

function money(amount: number, currency: string) {
  return `${currencySymbol(currency)} ${Math.round(amount).toLocaleString("en-US")}`;
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function shortDate(date: Date | null) {
  if (!date) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }).format(date);
}

/** Net SUCCESS booking-payments (deposit/full/balance) minus refunds, from an
 *  appointment's included payments. */
function netPaidForAppointment(payments: { amount: unknown; type: string; status: string }[]) {
  let paid = 0;
  for (const p of payments) {
    if (p.status !== "SUCCESS") continue;
    if (["DEPOSIT", "FULL_PAYMENT", "BALANCE"].includes(p.type)) paid += Number(p.amount);
    else if (p.type === "REFUND") paid -= Number(p.amount);
  }
  return paid;
}

function clientName(customer: { firstName: string; lastName: string | null } | null) {
  if (!customer) {
    return "Walk-in";
  }
  return [customer.firstName, customer.lastName].filter(Boolean).join(" ");
}

const fallbackPaymentData: Record<string, PaymentModuleData> = {
  "osu-glow-studio": {
    tenant: { id: "sample_osu_glow", name: "Osu Glow Studio", slug: "osu-glow-studio", currency: "GHS" },
    stats: [
      { label: "Collected", value: "GH₵ 250", detail: "Successful payments" },
      { label: "Deposits due", value: "GH₵ 200", detail: "1 appointment" },
      { label: "Outstanding", value: "GH₵ 0", detail: "Client balances" },
      { label: "Refunded", value: "GH₵ 0", detail: "0 refunds" },
    ],
    payments: [],
    depositsDue: [
      { appointmentId: "demo-3", customerId: "demo-customer-3", client: "Akua Mensah", service: "Wig install", amount: "GH₵ 200", amountRaw: 200, when: "13 Jul" },
    ],
    customers: [
      { id: "demo-customer-1", label: "Ama Serwaa" },
      { id: "demo-customer-2", label: "Esi Manu" },
      { id: "demo-customer-3", label: "Akua Mensah" },
    ],
    appointments: [
      { id: "demo-3", label: "Akua Mensah — Wig install (13 Jul)" },
    ],
    methods: PAYMENT_METHODS,
    types: PAYMENT_TYPES,
  },
  "luxe-lash-lab": {
    tenant: { id: "sample_luxe_lash", name: "Luxe Lash Lab", slug: "luxe-lash-lab", currency: "GHS" },
    stats: [
      { label: "Collected", value: "GH₵ 80", detail: "Successful payments" },
      { label: "Deposits due", value: "GH₵ 50", detail: "1 appointment" },
      { label: "Outstanding", value: "GH₵ 0", detail: "Client balances" },
      { label: "Refunded", value: "GH₵ 0", detail: "0 refunds" },
    ],
    payments: [],
    depositsDue: [
      { appointmentId: "demo-5", customerId: "demo-customer-5", client: "Afia Owusu", service: "Brow lamination", amount: "GH₵ 50", amountRaw: 50, when: "13 Jul" },
    ],
    customers: [
      { id: "demo-customer-4", label: "Yaa Boateng" },
      { id: "demo-customer-5", label: "Afia Owusu" },
    ],
    appointments: [
      { id: "demo-5", label: "Afia Owusu — Brow lamination (13 Jul)" },
    ],
    methods: PAYMENT_METHODS,
    types: PAYMENT_TYPES,
  },
};

export async function getPaymentModuleData(businessSlug: string): Promise<PaymentModuleData | null> {
  if (!isDatabaseConfigured()) {
    return fallbackPaymentData[businessSlug] ?? null;
  }

  const business = await prisma.business.findUnique({
    where: { slug: businessSlug },
    select: { id: true, name: true, slug: true, currency: true },
  });

  if (!business) {
    return null;
  }

  const [payments, appointments, customers, bookedAgg, bookingPaidAgg, incomingAgg, refundAgg] = await Promise.all([
    // History list only — the money stats below are aggregated in Postgres, not
    // summed from this capped page.
    prisma.payment.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { customer: true },
    }),
    // HOLD is excluded: a provisional date has no deposit to collect and must
    // not appear in payment history or balances (docs/HOLDS.md).
    prisma.appointment.findMany({
      where: { businessId: business.id, status: { notIn: ["CANCELLED", "NO_SHOW", "HOLD"] } },
      orderBy: { startAt: "desc" },
      include: { customer: true, service: true, payments: { select: { amount: true, type: true, status: true } } },
    }),
    prisma.customer.findMany({
      where: { businessId: business.id },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    // Outstanding is derived (booked − paid), never read from a stored counter.
    // `Customer.outstandingBalance` only ever decreased — booking never added to
    // it — so it sat at zero for every client and the figure was always a lie.
    prisma.appointment.aggregate({ _sum: { price: true }, where: bookedWhere(business.id) }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: bookingPaymentsWhere(business.id) }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: incomingWhere(business.id) }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: refundWhere(business.id) }),
  ]);

  const currency = business.currency;

  const collectedTotal = collected(Number(incomingAgg._sum.amount ?? 0), Number(refundAgg._sum.amount ?? 0));
  const refunded = Number(refundAgg._sum.amount ?? 0);

  // Deposit is 50% of price (money.ts), owed until it's been paid. Since
  // confirming a booking auto-logs the deposit, this list is now mostly the
  // pending bookings that haven't paid their 50% yet.
  const depositsDueList: DepositDue[] = appointments
    .map((a) => {
      const paid = netPaidForAppointment(a.payments);
      const due = depositDue(Number(a.price), paid);
      return { a, due };
    })
    .filter((x) => x.due > 0)
    .map(({ a, due }) => ({
      appointmentId: a.id,
      customerId: a.customerId,
      client: clientName(a.customer),
      service: a.service.name,
      amount: money(due, currency),
      amountRaw: due,
      when: shortDate(a.startAt),
    }));
  const depositsDueTotal = depositsDueList.reduce((sum, d) => sum + d.amountRaw, 0);
  const bookedTotal = Number(bookedAgg._sum.price ?? 0);
  const outstandingTotal = outstanding(bookedTotal, Number(bookingPaidAgg._sum.amount ?? 0));

  const stats: PaymentStat[] = [
    { label: "Collected", value: money(collectedTotal, currency), detail: "Payments in, less refunds" },
    {
      label: "Deposits due",
      value: money(depositsDueTotal, currency),
      detail: `${depositsDueList.length} ${depositsDueList.length === 1 ? "appointment" : "appointments"}`,
    },
    { label: "Outstanding", value: money(outstandingTotal, currency), detail: `Of ${money(bookedTotal, currency)} booked` },
    {
      label: "Refunded",
      value: money(refunded, currency),
      detail: `${payments.filter((p) => p.type === "REFUND").length} refunds`,
    },
  ];

  return {
    tenant: business,
    stats,
    payments: payments.map((p) => ({
      id: p.id,
      client: clientName(p.customer),
      method: METHOD_LABELS[p.method] ?? p.method,
      type: TYPE_LABELS[p.type] ?? p.type,
      amount: `${p.type === "REFUND" ? "-" : ""}${money(Number(p.amount), currency)}`,
      isRefund: p.type === "REFUND",
      status: titleCase(p.status),
      statusKey: p.status,
      when: shortDate(p.paidAt ?? p.createdAt),
    })),
    depositsDue: depositsDueList,
    customers: customers.map((c) => ({ id: c.id, label: clientName(c) })),
    appointments: appointments.slice(0, 50).map((a) => ({
      id: a.id,
      label: `${clientName(a.customer)} — ${a.service.name} (${shortDate(a.startAt)})`,
    })),
    methods: PAYMENT_METHODS,
    types: PAYMENT_TYPES,
  };
}

export async function recordPayment({
  businessSlug,
  customer,
  appointmentId,
  amount,
  method,
  type,
  reference,
}: {
  businessSlug: string;
  customer: string;
  appointmentId: string;
  amount: number;
  method: string;
  type: string;
  reference: string;
}) {
  if (!isDatabaseConfigured() || !Number.isFinite(amount) || amount <= 0) {
    return;
  }
  if (!VALID_METHODS.has(method) || !VALID_TYPES.has(type)) {
    return;
  }

  const business = await prisma.business.findUnique({
    where: { slug: businessSlug },
    select: { id: true },
  });

  if (!business) {
    return;
  }

  // Resolve a linked appointment (scoped to this business) if provided, and
  // derive the customer from it when one wasn't explicitly chosen.
  let appointment: { id: string; customerId: string } | null = null;
  if (appointmentId) {
    appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, businessId: business.id },
      select: { id: true, customerId: true },
    });
  }

  // Client accepts typed input: match an existing client by name or create one;
  // when left blank, fall back to the linked appointment's client (or walk-in).
  const resolvedCustomerId = customer.trim()
    ? await findOrCreateCustomer(business.id, customer)
    : appointment?.customerId ?? null;

  await tenantTransaction(async (tx) => {
    await tx.payment.create({
      data: {
        businessId: business.id,
        customerId: resolvedCustomerId,
        appointmentId: appointment?.id ?? null,
        amount,
        method: method as "PAYSTACK" | "HUBTEL" | "MOMO" | "TELECEL_CASH" | "BANK_TRANSFER" | "CASH",
        type: type as "DEPOSIT" | "FULL_PAYMENT" | "BALANCE" | "REFUND" | "PRODUCT_SALE",
        status: "SUCCESS",
        providerReference: reference.trim() || null,
        paidAt: new Date(),
      },
    });

    // A deposit payment against an appointment settles its deposit.
    if (appointment && type === "DEPOSIT") {
      await tx.appointment.update({
        where: { id: appointment.id },
        data: { depositPaid: true },
      });
    }

    // No balance counter is maintained here any more. `Customer.outstandingBalance`
    // was a running total that only ever decreased — booking an appointment never
    // added to it — so it sat at zero for every client and reported that nobody
    // owed anything. Outstanding is now derived wherever it's shown, from booked
    // appointments minus real payments. See src/lib/money.ts.
  }, { timeout: 15000 });
}

// ── Corrections (item 14) ────────────────────────────────────────────────────
//
// A completed payment is never rewritten. Amount, method and type are the
// transaction and are immutable once recorded. Corrections are: metadata edits
// (reference/note/appointment link — no money moves), VOID (recorded in error →
// status VOIDED, row kept, excluded from totals), and REFUND (a new offsetting
// REFUND payment linked to the original). Every one is audited by the action.

export type PaymentDetail = {
  id: string;
  clientName: string;
  amount: string;
  amountRaw: number;
  method: string;
  type: string;
  status: string;
  statusKey: string;
  reference: string;
  note: string;
  appointmentId: string;
  when: string;
  isRefund: boolean;
  /** SUCCESS incoming payments can be voided or refunded. */
  canVoid: boolean;
  canRefund: boolean;
  /** Amount still refundable = this payment minus refunds already offsetting it. */
  refundableRaw: number;
  refundable: string;
  currency: string;
  appointments: PaymentOption[];
};

export type PaymentWriteResult = { ok: true } | { ok: false; error: string };

const money2 = (amount: number, currency: string) =>
  `${currency === "GHS" ? "GH₵" : currency} ${Math.round(amount).toLocaleString("en-US")}`;

export async function getPaymentDetail(businessSlug: string, paymentId: string): Promise<PaymentDetail | null> {
  if (!isDatabaseConfigured()) return null;

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, business: { slug: businessSlug } },
    include: { business: { select: { currency: true } }, customer: true, appointment: { include: { service: true } } },
  });
  if (!payment) return null;

  const currency = payment.business.currency;
  const isRefund = payment.type === "REFUND";
  const amount = Number(payment.amount);

  // How much of this incoming payment has already been refunded against it.
  const refundedAgg = isRefund
    ? { _sum: { amount: null } }
    : await prisma.payment.aggregate({
        _sum: { amount: true },
        where: { businessId: payment.businessId, type: "REFUND", status: "SUCCESS", note: { contains: payment.id } },
      });
  const alreadyRefunded = Number(refundedAgg._sum.amount ?? 0);
  const refundableRaw = Math.max(0, amount - alreadyRefunded);

  const appointments = await prisma.appointment.findMany({
    where: { businessId: payment.businessId, status: { notIn: ["CANCELLED", "NO_SHOW", "HOLD"] } },
    orderBy: { startAt: "desc" },
    take: 100,
    include: { customer: true, service: true },
  });

  const activeIncoming = payment.status === "SUCCESS" && !isRefund;

  return {
    id: payment.id,
    clientName: clientName(payment.customer),
    amount: money2(amount, currency),
    amountRaw: amount,
    method: METHOD_LABELS[payment.method] ?? payment.method,
    type: TYPE_LABELS[payment.type] ?? payment.type,
    status: titleCase(payment.status),
    statusKey: payment.status,
    reference: payment.providerReference ?? "",
    note: payment.note ?? "",
    appointmentId: payment.appointmentId ?? "",
    when: shortDate(payment.paidAt ?? payment.createdAt),
    isRefund,
    canVoid: activeIncoming || payment.status === "PENDING",
    canRefund: activeIncoming && refundableRaw > 0,
    refundableRaw,
    refundable: money2(refundableRaw, currency),
    currency,
    appointments: appointments.map((a) => ({
      id: a.id,
      label: `${clientName(a.customer)} — ${a.service.name} (${shortDate(a.startAt)})`,
    })),
  };
}

/**
 * Metadata only: reference, note, and which appointment the payment settles.
 * Never touches amount, method, type or status — those are the transaction.
 */
export async function updatePaymentMeta(input: {
  businessSlug: string;
  paymentId: string;
  reference: string;
  note: string;
  appointmentId: string;
}): Promise<PaymentWriteResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Database not configured" };

  const payment = await prisma.payment.findFirst({
    where: { id: input.paymentId, business: { slug: input.businessSlug } },
    select: { id: true, businessId: true, customerId: true },
  });
  if (!payment) return { ok: false, error: "That payment no longer exists." };

  // If linking to an appointment, it must belong to this business.
  let appointmentId: string | null = null;
  if (input.appointmentId) {
    const appt = await prisma.appointment.findFirst({
      where: { id: input.appointmentId, businessId: payment.businessId },
      select: { id: true, customerId: true },
    });
    if (!appt) return { ok: false, error: "That appointment isn't in this workspace." };
    appointmentId = appt.id;
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      providerReference: input.reference.trim() || null,
      note: input.note.trim() || null,
      appointmentId,
    },
  });
  return { ok: true };
}

/**
 * Void a payment recorded in error: status → VOIDED, row kept. Only a SUCCESS
 * incoming payment or a PENDING one can be voided; a refund or an already-voided
 * row can't. The reason is stored on the row and by the action's audit entry.
 */
export async function voidPayment(businessSlug: string, paymentId: string, reason: string): Promise<PaymentWriteResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Database not configured" };

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, business: { slug: businessSlug } },
    select: { id: true, status: true, type: true, note: true },
  });
  if (!payment) return { ok: false, error: "That payment no longer exists." };
  if (payment.type === "REFUND") return { ok: false, error: "A refund can't be voided. Record a new payment if needed." };
  if (payment.status !== "SUCCESS" && payment.status !== "PENDING") {
    return { ok: false, error: `A ${payment.status.toLowerCase()} payment can't be voided.` };
  }

  const stamp = `Voided${reason.trim() ? `: ${reason.trim()}` : ""}`;
  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "VOIDED", note: payment.note ? `${payment.note} — ${stamp}` : stamp },
  });
  return { ok: true };
}

/**
 * Refund by creating a new offsetting REFUND payment linked (via note) to the
 * original. Never mutates the original — the two rows together tell the true
 * story. Refund amount is capped at what remains refundable on that payment.
 */
export async function refundPayment(
  businessSlug: string,
  paymentId: string,
  amount: number,
  reason: string,
): Promise<PaymentWriteResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Database not configured" };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Enter a refund amount." };

  const original = await prisma.payment.findFirst({
    where: { id: paymentId, business: { slug: businessSlug } },
    select: { id: true, businessId: true, customerId: true, appointmentId: true, amount: true, method: true, type: true, status: true },
  });
  if (!original) return { ok: false, error: "That payment no longer exists." };
  if (original.type === "REFUND") return { ok: false, error: "You can't refund a refund." };
  if (original.status !== "SUCCESS") return { ok: false, error: "Only a successful payment can be refunded." };

  const alreadyAgg = await prisma.payment.aggregate({
    _sum: { amount: true },
    where: { businessId: original.businessId, type: "REFUND", status: "SUCCESS", note: { contains: original.id } },
  });
  const refundable = Number(original.amount) - Number(alreadyAgg._sum.amount ?? 0);
  if (amount > refundable + 1e-9) {
    const left = Math.max(0, refundable).toLocaleString("en-US");
    return { ok: false, error: `Only ${left} is still refundable on this payment.` };
  }

  await prisma.payment.create({
    data: {
      businessId: original.businessId,
      customerId: original.customerId,
      appointmentId: original.appointmentId,
      amount,
      method: original.method,
      type: "REFUND",
      status: "SUCCESS",
      note: `Refund of payment ${original.id}${reason.trim() ? ` — ${reason.trim()}` : ""}`,
      paidAt: new Date(),
    },
  });
  return { ok: true };
}
