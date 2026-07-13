import "server-only";

import { prisma, isDatabaseConfigured } from "@/lib/prisma";

export type ClientRow = {
  id: string;
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

const fallbackClientData: Record<string, ClientModuleData> = {
  "osu-glow-studio": {
    tenant: { id: "sample_osu_glow", name: "Osu Glow Studio", slug: "osu-glow-studio", currency: "GHS" },
    stats: [
      { label: "Total clients", value: "3", detail: "1 added this week" },
      { label: "VIP clients", value: "1", detail: "Top 20% by spend" },
      { label: "Birthdays this month", value: "0", detail: "Send a treat" },
      { label: "Outstanding balances", value: "GH₵ 0", detail: "Across all clients" },
    ],
    clients: [
      { id: "demo-customer-1", name: "Ama Serwaa", contact: "+233200000001", tags: ["VIP"], visits: 1, lastVisit: "13 Jul", lifetimeSpend: "GH₵ 420", outstanding: "GH₵ 0", outstandingRaw: 0 },
      { id: "demo-customer-2", name: "Esi Manu", contact: "+233200000002", tags: ["repeat"], visits: 1, lastVisit: "13 Jul", lifetimeSpend: "GH₵ 650", outstanding: "GH₵ 0", outstandingRaw: 0 },
      { id: "demo-customer-3", name: "Akua Mensah", contact: "+233200000003", tags: ["bridal"], visits: 1, lastVisit: "13 Jul", lifetimeSpend: "GH₵ 780", outstanding: "GH₵ 0", outstandingRaw: 0 },
    ],
  },
  "luxe-lash-lab": {
    tenant: { id: "sample_luxe_lash", name: "Luxe Lash Lab", slug: "luxe-lash-lab", currency: "GHS" },
    stats: [
      { label: "Total clients", value: "3", detail: "New studio" },
      { label: "VIP clients", value: "1", detail: "Top 20% by spend" },
      { label: "Birthdays this month", value: "1", detail: "Send a treat" },
      { label: "Outstanding balances", value: "GH₵ 0", detail: "Across all clients" },
    ],
    clients: [
      { id: "demo-customer-4", name: "Yaa Boateng", contact: "+233200000004", tags: ["new"], visits: 1, lastVisit: "13 Jul", lifetimeSpend: "GH₵ 360", outstanding: "GH₵ 0", outstandingRaw: 0 },
      { id: "demo-customer-5", name: "Afia Owusu", contact: "+233200000005", tags: ["VIP"], visits: 1, lastVisit: "13 Jul", lifetimeSpend: "GH₵ 220", outstanding: "GH₵ 0", outstandingRaw: 0 },
      { id: "demo-customer-6", name: "Serwaa King", contact: "+233200000006", tags: ["birthday"], visits: 0, lastVisit: "—", lifetimeSpend: "GH₵ 0", outstanding: "GH₵ 0", outstandingRaw: 0 },
    ],
  },
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
  if (!isDatabaseConfigured()) {
    return fallbackClientData[businessSlug] ?? null;
  }

  const business = await prisma.business.findUnique({
    where: { slug: businessSlug },
    select: { id: true, name: true, slug: true, currency: true },
  });

  if (!business) {
    return null;
  }

  const customers = await prisma.customer.findMany({
    where: { businessId: business.id },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    include: {
      appointments: {
        select: { status: true, price: true, startAt: true },
        orderBy: { startAt: "desc" },
      },
    },
  });

  const currency = business.currency;
  const now = new Date();
  const currentMonth = now.getUTCMonth();

  const clients: ClientRow[] = customers.map((customer) => {
    const realisedVisits = customer.appointments.filter((appointment) =>
      (REALISED_STATUSES as readonly string[]).includes(appointment.status),
    );
    const lifetimeSpend = realisedVisits.reduce((sum, appointment) => sum + Number(appointment.price), 0);
    const lastVisit = customer.appointments.find((appointment) => appointment.status === "COMPLETED")?.startAt
      ?? customer.appointments[0]?.startAt
      ?? null;
    const outstandingRaw = Number(customer.outstandingBalance);

    return {
      id: customer.id,
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
