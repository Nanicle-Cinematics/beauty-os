import "server-only";

import { prisma, tenantTransaction, isDatabaseConfigured } from "@/lib/prisma";
import { findOrCreateCustomer } from "@/lib/entity-resolve";
import { calculateInvoicePaymentState, calculateInvoiceTotals, roundMoney, type InvoiceStatus } from "@/lib/invoice-math";

export type InvoiceWriteResult = { ok: true; id?: string } | { ok: false; error: string };
export type InvoiceOption = { id: string; label: string };
export type InvoiceStat = { label: string; value: string; detail: string };

export type InvoiceRow = {
  id: string;
  number: string;
  client: string;
  appointment: string;
  total: string;
  paid: string;
  balance: string;
  status: string;
  statusKey: string;
  due: string;
  issued: string;
};

export type InvoiceModuleData = {
  tenant: { id: string; name: string; slug: string; currency: string };
  stats: InvoiceStat[];
  invoices: InvoiceRow[];
  customers: InvoiceOption[];
  appointments: InvoiceOption[];
};

export type InvoiceDetail = {
  id: string;
  number: string;
  clientName: string;
  appointmentLabel: string;
  status: string;
  statusKey: InvoiceStatus;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  paid: string;
  balance: string;
  balanceRaw: number;
  currency: string;
  dueDate: string;
  issuedAt: string;
  sentAt: string;
  paidAt: string;
  notes: string;
  terms: string;
  lineItems: { id: string; description: string; quantity: string; unitPrice: string; discount: string; tax: string; total: string }[];
  payments: { id: string; type: string; method: string; amount: string; status: string; when: string; isRefund: boolean }[];
};

export type InvoiceFormData = {
  tenant: { id: string; name: string; slug: string; currency: string };
  customers: InvoiceOption[];
  appointments: Array<InvoiceOption & { customerId: string; customerName: string; service: string; price: number; dueDate: string }>;
  defaultInvoiceNumber: string;
};

const INCOMING_TYPES = new Set(["DEPOSIT", "FULL_PAYMENT", "BALANCE", "PRODUCT_SALE"]);
export const PAYMENT_METHODS = [
  { value: "PAYSTACK", label: "Paystack" },
  { value: "HUBTEL", label: "Hubtel" },
  { value: "MOMO", label: "MTN MoMo" },
  { value: "TELECEL_CASH", label: "Telecel Cash" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CASH", label: "Cash" },
];
const METHOD_LABELS = Object.fromEntries(PAYMENT_METHODS.map((method) => [method.value, method.label]));

function currencySymbol(currency: string) {
  return currency === "GHS" ? "GH₵" : currency;
}

function money(amount: number, currency: string) {
  return `${currencySymbol(currency)} ${roundMoney(amount).toLocaleString("en-US")}`;
}

function shortDate(date: Date | null) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function dateInput(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

function clientName(customer: { firstName: string; lastName: string | null } | null) {
  if (!customer) return "Walk-in";
  return [customer.firstName, customer.lastName].filter(Boolean).join(" ");
}

function titleCase(value: string) {
  return value.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function paymentSums(payments: { amount: unknown; type: string; status: string }[]) {
  let paid = 0;
  let refunded = 0;
  for (const payment of payments) {
    if (payment.status !== "SUCCESS") continue;
    if (payment.type === "REFUND") refunded += Number(payment.amount);
    else if (INCOMING_TYPES.has(payment.type)) paid += Number(payment.amount);
  }
  return { paid, refunded };
}

function deriveStatus(invoice: { status: string; total: unknown; dueDate: Date | null; payments: { amount: unknown; type: string; status: string }[] }) {
  const { paid, refunded } = paymentSums(invoice.payments);
  return calculateInvoicePaymentState({
    total: Number(invoice.total),
    paid,
    refunded,
    dueDate: invoice.dueDate,
    currentStatus: invoice.status as InvoiceStatus,
  });
}

async function nextInvoiceNumber(businessId: string) {
  const now = new Date();
  const prefix = `INV-${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const count = await prisma.invoice.count({ where: { businessId, invoiceNumber: { startsWith: prefix } } });
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

export async function getInvoiceModuleData(businessSlug: string, filters: { q?: string; status?: string } = {}): Promise<InvoiceModuleData | null> {
  if (!isDatabaseConfigured()) return null;

  const business = await prisma.business.findUnique({ where: { slug: businessSlug }, select: { id: true, name: true, slug: true, currency: true } });
  if (!business) return null;

  const [invoices, customers, appointments] = await Promise.all([
    prisma.invoice.findMany({
      where: { businessId: business.id },
      orderBy: { issuedAt: "desc" },
      take: 50,
      select: {
        id: true,
        invoiceNumber: true,
        subtotal: true,
        discountAmount: true,
        taxAmount: true,
        total: true,
        status: true,
        issuedAt: true,
        dueDate: true,
        paidAt: true,
        customer: { select: { firstName: true, lastName: true } },
        appointment: { select: { service: { select: { name: true } } } },
        payments: { select: { amount: true, type: true, status: true } },
      },
    }),
    prisma.customer.findMany({
      where: { businessId: business.id, archivedAt: null },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.appointment.findMany({
      where: { businessId: business.id, status: { notIn: ["CANCELLED", "NO_SHOW", "HOLD"] } },
      orderBy: { startAt: "desc" },
      take: 100,
      select: {
        id: true,
        startAt: true,
        customer: { select: { firstName: true, lastName: true } },
        service: { select: { name: true } },
      },
    }),
  ]);

  const rows = invoices.map((invoice) => {
    const state = deriveStatus(invoice);
    return { invoice, state };
  });
  const now = new Date();
  const unpaid = rows.filter(({ state }) => state.balanceDue > 0 && state.status !== "VOID");
  const overdue = rows.filter(({ state }) => state.status === "OVERDUE");
  const paidThisMonth = rows
    .filter(({ state, invoice }) =>
      state.status === "PAID" &&
      invoice.paidAt &&
      invoice.paidAt.getUTCFullYear() === now.getUTCFullYear() &&
      invoice.paidAt.getUTCMonth() === now.getUTCMonth()
    )
    .reduce((sum, { invoice }) => sum + Number(invoice.total), 0);

  return {
    tenant: business,
    stats: [
      { label: "Unpaid", value: money(unpaid.reduce((sum, row) => sum + row.state.balanceDue, 0), business.currency), detail: `${unpaid.length} open invoices` },
      { label: "Overdue", value: money(overdue.reduce((sum, row) => sum + row.state.balanceDue, 0), business.currency), detail: `${overdue.length} past due` },
      { label: "Paid this month", value: money(paidThisMonth, business.currency), detail: "Settled invoices" },
      { label: "Drafts", value: String(rows.filter(({ invoice }) => invoice.status === "DRAFT").length), detail: "Not sent yet" },
    ],
    invoices: rows
      .filter(({ invoice, state }) => {
        const q = filters.q?.trim().toLowerCase();
        const status = filters.status?.trim();
        if (status && status !== "ALL" && state.status !== status) return false;
        if (!q) return true;
        return invoice.invoiceNumber.toLowerCase().includes(q) || clientName(invoice.customer).toLowerCase().includes(q);
      })
      .map(({ invoice, state }) => ({
      id: invoice.id,
      number: invoice.invoiceNumber,
      client: clientName(invoice.customer),
      appointment: invoice.appointment ? invoice.appointment.service.name : "Manual invoice",
      total: money(Number(invoice.total), business.currency),
      paid: money(state.paidNet, business.currency),
      balance: money(state.balanceDue, business.currency),
      status: titleCase(state.status),
      statusKey: state.status,
      due: shortDate(invoice.dueDate),
      issued: shortDate(invoice.issuedAt),
    })),
    customers: customers.map((customer) => ({ id: customer.id, label: clientName(customer) })),
    appointments: appointments.map((appointment) => ({ id: appointment.id, label: `${clientName(appointment.customer)} - ${appointment.service.name} (${shortDate(appointment.startAt)})` })),
  };
}

export async function getInvoiceFormData(businessSlug: string): Promise<InvoiceFormData | null> {
  if (!isDatabaseConfigured()) return null;
  const business = await prisma.business.findUnique({ where: { slug: businessSlug }, select: { id: true, name: true, slug: true, currency: true } });
  if (!business) return null;

  const [customers, appointments, defaultInvoiceNumber] = await Promise.all([
    prisma.customer.findMany({ where: { businessId: business.id, archivedAt: null }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] }),
    prisma.appointment.findMany({
      where: { businessId: business.id, status: { notIn: ["CANCELLED", "NO_SHOW", "HOLD"] } },
      orderBy: { startAt: "desc" },
      take: 100,
      include: { customer: true, service: true },
    }),
    nextInvoiceNumber(business.id),
  ]);

  return {
    tenant: business,
    customers: customers.map((customer) => ({ id: customer.id, label: clientName(customer) })),
    appointments: appointments.map((appointment) => ({
      id: appointment.id,
      customerId: appointment.customerId,
      customerName: clientName(appointment.customer),
      service: appointment.service.name,
      price: Number(appointment.price),
      dueDate: dateInput(appointment.startAt),
      label: `${clientName(appointment.customer)} - ${appointment.service.name} (${shortDate(appointment.startAt)})`,
    })),
    defaultInvoiceNumber,
  };
}

export async function getInvoiceDetail(businessSlug: string, invoiceId: string): Promise<InvoiceDetail | null> {
  if (!isDatabaseConfigured()) return null;

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, business: { slug: businessSlug } },
    include: {
      business: { select: { currency: true } },
      customer: true,
      appointment: { include: { service: true } },
      lineItems: { orderBy: { id: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!invoice) return null;

  const currency = invoice.business.currency;
  const state = deriveStatus(invoice);

  return {
    id: invoice.id,
    number: invoice.invoiceNumber,
    clientName: clientName(invoice.customer),
    appointmentLabel: invoice.appointment ? invoice.appointment.service.name : "Manual invoice",
    status: titleCase(state.status),
    statusKey: state.status,
    subtotal: money(Number(invoice.subtotal), currency),
    discount: money(Number(invoice.discountAmount), currency),
    tax: money(Number(invoice.taxAmount), currency),
    total: money(Number(invoice.total), currency),
    paid: money(state.paidNet, currency),
    balance: money(state.balanceDue, currency),
    balanceRaw: state.balanceDue,
    currency,
    dueDate: dateInput(invoice.dueDate),
    issuedAt: shortDate(invoice.issuedAt),
    sentAt: shortDate(invoice.sentAt),
    paidAt: shortDate(invoice.paidAt),
    notes: invoice.notes ?? "",
    terms: invoice.terms ?? "",
    lineItems: invoice.lineItems.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: String(item.quantity),
      unitPrice: money(Number(item.unitPrice), currency),
      discount: money(Number(item.discountAmount), currency),
      tax: money(Number(item.taxAmount), currency),
      total: money(Number(item.total), currency),
    })),
    payments: invoice.payments.map((payment) => ({
      id: payment.id,
      type: titleCase(payment.type),
      method: METHOD_LABELS[payment.method] ?? payment.method,
      amount: `${payment.type === "REFUND" ? "-" : ""}${money(Number(payment.amount), currency)}`,
      status: titleCase(payment.status),
      when: shortDate(payment.paidAt ?? payment.createdAt),
      isRefund: payment.type === "REFUND",
    })),
  };
}

export async function createInvoice(input: {
  businessSlug: string;
  customer: string;
  appointmentId: string;
  invoiceNumber: string;
  dueDate: Date | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  notes: string;
  terms: string;
}): Promise<InvoiceWriteResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Database not configured" };
  if (!input.customer.trim() && !input.appointmentId) return { ok: false, error: "Choose a client or appointment." };
  if (!input.description.trim()) return { ok: false, error: "Add at least one line item." };
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) return { ok: false, error: "Quantity must be greater than zero." };
  if (!Number.isFinite(input.unitPrice) || input.unitPrice < 0) return { ok: false, error: "Unit price must be zero or more." };

  const business = await prisma.business.findUnique({ where: { slug: input.businessSlug }, select: { id: true } });
  if (!business) return { ok: false, error: "Workspace not found." };

  const existingNumber = await prisma.invoice.findFirst({ where: { businessId: business.id, invoiceNumber: input.invoiceNumber.trim() }, select: { id: true } });
  if (existingNumber) return { ok: false, error: "That invoice number is already in use." };

  let appointment: { id: string; customerId: string; price: unknown; service: { name: string } } | null = null;
  if (input.appointmentId) {
    appointment = await prisma.appointment.findFirst({
      where: { id: input.appointmentId, businessId: business.id },
      select: { id: true, customerId: true, price: true, service: { select: { name: true } } },
    });
    if (!appointment) return { ok: false, error: "That appointment is not in this workspace." };
  }

  const customerId = input.customer.trim() ? await findOrCreateCustomer(business.id, input.customer) : appointment?.customerId;
  if (!customerId) return { ok: false, error: "Choose a client." };

  const quantity = roundMoney(input.quantity);
  const unitPrice = roundMoney(input.unitPrice);
  const subtotal = roundMoney(quantity * unitPrice);
  const totals = calculateInvoiceTotals({ subtotal, discount: input.discount, tax: input.tax });

  const invoice = await tenantTransaction(async (tx) => tx.invoice.create({
    data: {
      businessId: business.id,
      customerId,
      appointmentId: appointment?.id ?? null,
      invoiceNumber: input.invoiceNumber.trim(),
      subtotal: totals.subtotal,
      discountAmount: totals.discount,
      taxAmount: totals.tax,
      total: totals.total,
      amountPaid: 0,
      dueDate: input.dueDate,
      notes: input.notes.trim() || null,
      terms: input.terms.trim() || null,
      lineItems: {
        create: [{
          description: input.description.trim(),
          quantity,
          unitPrice,
          discountAmount: totals.discount,
          taxAmount: totals.tax,
          total: totals.total,
        }],
      },
    },
    select: { id: true },
  }), { timeout: 15000 });

  return { ok: true, id: invoice.id };
}

export async function createInvoiceFromAppointment(businessSlug: string, appointmentId: string): Promise<InvoiceWriteResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Database not configured" };

  const business = await prisma.business.findUnique({ where: { slug: businessSlug }, select: { id: true } });
  if (!business) return { ok: false, error: "Workspace not found." };

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, businessId: business.id },
    include: { service: true, invoices: { select: { id: true }, take: 1 } },
  });
  if (!appointment) return { ok: false, error: "That appointment no longer exists." };
  if (appointment.invoices[0]) return { ok: true, id: appointment.invoices[0].id };

  const invoiceNumber = await nextInvoiceNumber(business.id);
  const total = roundMoney(Number(appointment.price));
  const invoice = await tenantTransaction(async (tx) => tx.invoice.create({
    data: {
      businessId: business.id,
      customerId: appointment.customerId,
      appointmentId: appointment.id,
      invoiceNumber,
      subtotal: total,
      total,
      dueDate: appointment.startAt,
      terms: appointment.service.cancellationPolicy || null,
      lineItems: {
        create: [{ description: appointment.service.name, quantity: 1, unitPrice: total, total }],
      },
    },
    select: { id: true },
  }), { timeout: 15000 });

  return { ok: true, id: invoice.id };
}

export async function sendInvoice(businessSlug: string, invoiceId: string): Promise<InvoiceWriteResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Database not configured" };
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, business: { slug: businessSlug } }, select: { id: true, status: true } });
  if (!invoice) return { ok: false, error: "That invoice no longer exists." };
  if (invoice.status === "VOID") return { ok: false, error: "A void invoice can't be sent." };
  await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "SENT", sentAt: new Date() } });
  return { ok: true };
}

export async function voidInvoice(businessSlug: string, invoiceId: string): Promise<InvoiceWriteResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Database not configured" };
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, business: { slug: businessSlug } },
    select: { id: true, payments: { select: { status: true, type: true, amount: true } } },
  });
  if (!invoice) return { ok: false, error: "That invoice no longer exists." };
  const { paid, refunded } = paymentSums(invoice.payments);
  if (paid - refunded > 0) return { ok: false, error: "Resolve linked payments before voiding this invoice." };
  await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "VOID" } });
  return { ok: true };
}

export async function syncInvoicePaymentState(businessSlug: string, invoiceId: string) {
  if (!isDatabaseConfigured() || !invoiceId) return;
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, business: { slug: businessSlug } },
    select: { id: true, total: true, status: true, dueDate: true, payments: { select: { amount: true, type: true, status: true } } },
  });
  if (!invoice) return;
  const { paid, refunded } = paymentSums(invoice.payments);
  const state = calculateInvoicePaymentState({ total: Number(invoice.total), paid, refunded, dueDate: invoice.dueDate, currentStatus: invoice.status as InvoiceStatus });
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      amountPaid: state.paidNet,
      status: state.status,
      paidAt: state.status === "PAID" ? new Date() : null,
    },
  });
}
