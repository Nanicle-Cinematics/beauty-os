import "server-only";

import { prisma, isDatabaseConfigured } from "@/lib/prisma";

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
// Incoming money reduces what a client owes; a refund gives money back.
const INCOMING_TYPES = new Set(["DEPOSIT", "FULL_PAYMENT", "BALANCE", "PRODUCT_SALE"]);

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

  const [payments, appointments, customers, outstandingAgg] = await Promise.all([
    prisma.payment.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { customer: true },
    }),
    prisma.appointment.findMany({
      where: { businessId: business.id, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
      orderBy: { startAt: "desc" },
      include: { customer: true, service: true },
    }),
    prisma.customer.findMany({
      where: { businessId: business.id },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.customer.aggregate({
      where: { businessId: business.id },
      _sum: { outstandingBalance: true },
    }),
  ]);

  const currency = business.currency;

  const collected = payments
    .filter((p) => p.status === "SUCCESS" && p.type !== "REFUND")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const refunded = payments
    .filter((p) => p.type === "REFUND" && (p.status === "SUCCESS" || p.status === "REFUNDED"))
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const depositsDueList: DepositDue[] = appointments
    .filter((a) => a.depositAmount && Number(a.depositAmount) > 0 && !a.depositPaid)
    .map((a) => ({
      appointmentId: a.id,
      customerId: a.customerId,
      client: clientName(a.customer),
      service: a.service.name,
      amount: money(Number(a.depositAmount), currency),
      amountRaw: Number(a.depositAmount),
      when: shortDate(a.startAt),
    }));
  const depositsDueTotal = depositsDueList.reduce((sum, d) => sum + d.amountRaw, 0);
  const outstanding = Number(outstandingAgg._sum.outstandingBalance ?? 0);

  const stats: PaymentStat[] = [
    { label: "Collected", value: money(collected, currency), detail: "Successful payments" },
    {
      label: "Deposits due",
      value: money(depositsDueTotal, currency),
      detail: `${depositsDueList.length} ${depositsDueList.length === 1 ? "appointment" : "appointments"}`,
    },
    { label: "Outstanding", value: money(outstanding, currency), detail: "Client balances" },
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
  customerId,
  appointmentId,
  amount,
  method,
  type,
  reference,
}: {
  businessSlug: string;
  customerId: string;
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

  const resolvedCustomerId = customerId
    ? (
        await prisma.customer.findFirst({
          where: { id: customerId, businessId: business.id },
          select: { id: true },
        })
      )?.id ?? null
    : appointment?.customerId ?? null;

  await prisma.$transaction(async (tx) => {
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

    // Keep the client's running balance in step: incoming money reduces it
    // (never below zero), a refund increases it.
    if (resolvedCustomerId) {
      const customer = await tx.customer.findUnique({
        where: { id: resolvedCustomerId },
        select: { outstandingBalance: true },
      });
      if (customer) {
        const current = Number(customer.outstandingBalance);
        const next = INCOMING_TYPES.has(type)
          ? Math.max(0, current - amount)
          : current + amount;
        await tx.customer.update({
          where: { id: resolvedCustomerId },
          data: { outstandingBalance: next },
        });
      }
    }
  });
}
