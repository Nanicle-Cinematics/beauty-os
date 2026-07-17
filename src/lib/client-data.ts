import "server-only";

import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { bookingPaymentsWhere, refundWhere, collected, outstanding } from "@/lib/money";

export type ClientRow = {
  id: string;
  archived: boolean;
  name: string;
  contact: string;
  tags: string[];
  visits: number;
  lastVisit: string;
  lifetimeSpend: string;
  outstanding: string;
  outstandingRaw: number;
};

export type ClientStat = {
  label: string;
  value: string;
  detail: string;
};

/** Every editable field on a client, plus the history that gates deletion. */
export type ClientDetail = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  addressLine1: string;
  city: string;
  birthdate: string;
  anniversaryDate: string;
  skinNotes: string;
  allergies: string;
  tags: string;
  marketingOptInEmail: boolean;
  marketingOptInSms: boolean;
  marketingOptInWhatsapp: boolean;
  archived: boolean;
  /** Appointments + payments on file. Non-zero means archive, never delete. */
  historyCount: number;
  appointmentCount: number;
  paymentCount: number;
  lifetimeSpend: string;
  outstanding: string;
};

export type ClientWriteResult = { ok: true } | { ok: false; error: string };

export type ClientModuleData = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    currency: string;
  };
  stats: ClientStat[];
  clients: ClientRow[];
};

function currencySymbol(currency: string) {
  return currency === "GHS" ? "GH₵" : currency;
}

function money(amount: number, currency: string) {
  return `${currencySymbol(currency)} ${amount.toLocaleString("en-US")}`;
}

function shortDate(date: Date | null) {
  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }).format(date);
}

// Statuses that represent money the studio actually earned from a visit.
const REALISED_STATUSES = ["COMPLETED", "CONFIRMED"] as const;

export async function getClientModuleData(businessSlug: string): Promise<ClientModuleData | null> {
  // No demo fallback — inventing client records when the database is
  // unreachable would show a studio someone else's clients. Caller 404s instead.
  if (!isDatabaseConfigured()) {
    return null;
  }

  const business = await prisma.business.findUnique({
    where: { slug: businessSlug },
    select: { id: true, name: true, slug: true, currency: true },
  });

  if (!business) {
    return null;
  }

  const [customers, paidGroups, refundGroups] = await Promise.all([
    // Working list excludes archived clients; they keep their history and can be
    // restored, but they are not part of day-to-day work.
    prisma.customer.findMany({
      where: { businessId: business.id, archivedAt: null },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      include: {
        appointments: {
          select: { status: true, price: true, startAt: true },
          orderBy: { startAt: "desc" },
        },
      },
    }),
    // What each client has actually handed over, and taken back. Spend and
    // balance are derived from these — never from appointment prices, and never
    // from the retired `Customer.outstandingBalance` counter. See money.ts.
    prisma.payment.groupBy({ by: ["customerId"], _sum: { amount: true }, where: bookingPaymentsWhere(business.id) }),
    prisma.payment.groupBy({ by: ["customerId"], _sum: { amount: true }, where: refundWhere(business.id) }),
  ]);

  const paidByCustomer = new Map(paidGroups.map((g) => [g.customerId, Number(g._sum.amount ?? 0)]));
  const refundedByCustomer = new Map(refundGroups.map((g) => [g.customerId, Number(g._sum.amount ?? 0)]));

  const currency = business.currency;
  const now = new Date();
  const currentMonth = now.getUTCMonth();

  const clients: ClientRow[] = customers.map((customer) => {
    const realisedVisits = customer.appointments.filter((appointment) =>
      (REALISED_STATUSES as readonly string[]).includes(appointment.status),
    );
    // Booked is what they agreed to pay; spend is what they actually paid. These
    // were the same number before, which meant an unpaid booking counted as
    // lifetime spend.
    const booked = realisedVisits.reduce((sum, appointment) => sum + Number(appointment.price), 0);
    const lifetimeSpend = collected(paidByCustomer.get(customer.id) ?? 0, refundedByCustomer.get(customer.id) ?? 0);
    const lastVisit = customer.appointments.find((appointment) => appointment.status === "COMPLETED")?.startAt
      ?? customer.appointments[0]?.startAt
      ?? null;
    const outstandingRaw = outstanding(booked, paidByCustomer.get(customer.id) ?? 0);

    return {
      id: customer.id,
      archived: customer.archivedAt != null,
      name: [customer.firstName, customer.lastName].filter(Boolean).join(" "),
      contact: customer.phone || customer.email || "No contact on file",
      tags: customer.tags,
      visits: realisedVisits.length,
      lastVisit: shortDate(lastVisit),
      lifetimeSpend: money(lifetimeSpend, currency),
      outstanding: money(outstandingRaw, currency),
      outstandingRaw,
    };
  });

  const spendByClient = clients.map((client) =>
    Number(client.lifetimeSpend.replace(/[^0-9.]/g, "")) || 0,
  );
  const vipThreshold = spendByClient.length
    ? [...spendByClient].sort((a, b) => b - a)[Math.max(0, Math.ceil(spendByClient.length * 0.2) - 1)]
    : 0;
  const vipCount = spendByClient.filter((spend) => spend > 0 && spend >= vipThreshold).length;

  const birthdaysThisMonth = customers.filter(
    (customer) => customer.birthdate && customer.birthdate.getUTCMonth() === currentMonth,
  ).length;

  const totalOutstanding = clients.reduce((sum, client) => sum + client.outstandingRaw, 0);

  const stats: ClientStat[] = [
    { label: "Total clients", value: String(customers.length), detail: "In this workspace" },
    { label: "VIP clients", value: String(vipCount), detail: "Top 20% by spend" },
    { label: "Birthdays this month", value: String(birthdaysThisMonth), detail: "Send a treat" },
    { label: "Outstanding balances", value: money(totalOutstanding, currency), detail: "Across all clients" },
  ];

  return { tenant: business, stats, clients };
}

const dateInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export async function getClientDetail(businessSlug: string, clientId: string): Promise<ClientDetail | null> {
  if (!isDatabaseConfigured()) return null;

  const customer = await prisma.customer.findFirst({
    where: { id: clientId, business: { slug: businessSlug } },
    include: {
      business: { select: { currency: true } },
      appointments: { select: { status: true, price: true } },
      _count: { select: { appointments: true, payments: true } },
    },
  });
  if (!customer) return null;

  const [paidAgg, refundAgg] = await Promise.all([
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { ...bookingPaymentsWhere(customer.businessId), customerId: customer.id },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { ...refundWhere(customer.businessId), customerId: customer.id },
    }),
  ]);

  const currency = customer.business.currency;
  const paid = Number(paidAgg._sum.amount ?? 0);
  const booked = customer.appointments
    .filter((a) => (REALISED_STATUSES as readonly string[]).includes(a.status))
    .reduce((sum, a) => sum + Number(a.price), 0);

  return {
    id: customer.id,
    firstName: customer.firstName,
    lastName: customer.lastName ?? "",
    phone: customer.phone ?? "",
    email: customer.email ?? "",
    addressLine1: customer.addressLine1 ?? "",
    city: customer.city ?? "",
    birthdate: dateInput(customer.birthdate),
    anniversaryDate: dateInput(customer.anniversaryDate),
    skinNotes: customer.skinNotes ?? "",
    allergies: customer.allergies ?? "",
    tags: customer.tags.join(", "),
    marketingOptInEmail: customer.marketingOptInEmail,
    marketingOptInSms: customer.marketingOptInSms,
    marketingOptInWhatsapp: customer.marketingOptInWhatsapp,
    archived: customer.archivedAt != null,
    historyCount: customer._count.appointments + customer._count.payments,
    appointmentCount: customer._count.appointments,
    paymentCount: customer._count.payments,
    lifetimeSpend: money(collected(paid, Number(refundAgg._sum.amount ?? 0)), currency),
    outstanding: money(outstanding(booked, paid), currency),
  };
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function updateClient(input: {
  businessSlug: string;
  clientId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  addressLine1: string;
  city: string;
  birthdate: Date | null;
  anniversaryDate: Date | null;
  tags: string[];
  skinNotes: string;
  allergies: string;
  marketingOptInEmail: boolean;
  marketingOptInSms: boolean;
  marketingOptInWhatsapp: boolean;
}): Promise<ClientWriteResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Database not configured" };

  if (!input.firstName.trim()) return { ok: false, error: "A first name is required." };
  if (input.email.trim() && !EMAIL_RE.test(input.email.trim())) {
    return { ok: false, error: "That email address doesn't look right." };
  }

  const existing = await prisma.customer.findFirst({
    where: { id: input.clientId, business: { slug: input.businessSlug } },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "That client no longer exists." };

  await prisma.customer.update({
    where: { id: existing.id },
    data: {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim() || null,
      phone: input.phone.trim() || null,
      email: input.email.trim() || null,
      addressLine1: input.addressLine1.trim() || null,
      city: input.city.trim() || null,
      birthdate: input.birthdate,
      anniversaryDate: input.anniversaryDate,
      tags: input.tags,
      skinNotes: input.skinNotes.trim() || null,
      allergies: input.allergies.trim() || null,
      marketingOptInEmail: input.marketingOptInEmail,
      marketingOptInSms: input.marketingOptInSms,
      marketingOptInWhatsapp: input.marketingOptInWhatsapp,
    },
  });

  return { ok: true };
}

export async function setClientArchived(
  businessSlug: string,
  clientId: string,
  archived: boolean,
): Promise<ClientWriteResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Database not configured" };

  const { count } = await prisma.customer.updateMany({
    where: { id: clientId, business: { slug: businessSlug } },
    data: { archivedAt: archived ? new Date() : null },
  });

  return count > 0 ? { ok: true } : { ok: false, error: "That client no longer exists." };
}

/**
 * Hard delete, permitted only for a client with no history.
 *
 * A client with appointments or payments is archived instead: deleting them
 * would orphan bookings and silently rewrite the financial record. The guard
 * lives here rather than in the UI so it holds however the function is called.
 */
export async function deleteClient(businessSlug: string, clientId: string): Promise<ClientWriteResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Database not configured" };

  const customer = await prisma.customer.findFirst({
    where: { id: clientId, business: { slug: businessSlug } },
    select: { id: true, _count: { select: { appointments: true, payments: true } } },
  });
  if (!customer) return { ok: false, error: "That client no longer exists." };

  const history = customer._count.appointments + customer._count.payments;
  if (history > 0) {
    return {
      ok: false,
      error: `This client has ${history} booking${history === 1 ? "" : "s"} or payment${history === 1 ? "" : "s"} on file. Archive them instead — deleting would remove that history.`,
    };
  }

  await prisma.customer.delete({ where: { id: customer.id } });
  return { ok: true };
}

export async function createClient({
  businessSlug,
  firstName,
  lastName,
  phone,
  email,
  city,
  birthdate,
  tags,
  skinNotes,
  allergies,
}: {
  businessSlug: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  city: string;
  birthdate: Date | null;
  tags: string[];
  skinNotes: string;
  allergies: string;
}) {
  if (!isDatabaseConfigured()) {
    return;
  }

  const business = await prisma.business.findUnique({
    where: { slug: businessSlug },
    select: { id: true },
  });

  if (!business || !firstName.trim()) {
    return;
  }

  await prisma.customer.create({
    data: {
      businessId: business.id,
      firstName: firstName.trim(),
      lastName: lastName.trim() || null,
      phone: phone.trim() || null,
      email: email.trim().toLowerCase() || null,
      city: city.trim() || null,
      birthdate,
      tags,
      skinNotes: skinNotes.trim() || null,
      allergies: allergies.trim() || null,
    },
  });
}
