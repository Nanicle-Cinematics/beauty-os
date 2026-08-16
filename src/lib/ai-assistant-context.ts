import "server-only";

import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { getAiInsightsData } from "@/lib/ai-insights-data";
import { money } from "@/lib/format";
import { formatDayMonthInTz, formatTimeInTz } from "@/lib/date";
import { depositDue } from "@/lib/money";

const DAY = 24 * 60 * 60 * 1000;

function clientName(customer: { firstName: string; lastName: string | null } | null | undefined) {
  if (!customer) return "Walk-in";
  return [customer.firstName, customer.lastName].filter(Boolean).join(" ");
}

function paidForAppointment(payments: { amount: unknown; type: string; status: string }[]) {
  let paid = 0;
  for (const payment of payments) {
    if (payment.status !== "SUCCESS") continue;
    if (payment.type === "REFUND") paid -= Number(payment.amount);
    else if (["DEPOSIT", "FULL_PAYMENT", "BALANCE"].includes(payment.type)) paid += Number(payment.amount);
  }
  return paid;
}

export async function getAiAssistantContext(businessSlug: string) {
  if (!isDatabaseConfigured()) {
    const insights = await getAiInsightsData(businessSlug);
    return {
      business: insights?.tenant ?? { name: businessSlug },
      summary: insights?.summary ?? "No database is configured.",
      focus: insights?.focus ?? "Demo mode",
      moneyAtRisk: insights?.moneyAtRisk ?? "n/a",
      insights: insights?.insights ?? [],
      operationalData: {
        note: "Database is not configured, so only demo insight context is available.",
      },
    };
  }

  const business = await prisma.business.findUnique({
    where: { slug: businessSlug },
    select: { id: true, name: true, currency: true, timezone: true },
  });
  if (!business) return null;

  const now = new Date();
  const next14 = new Date(now.getTime() + 14 * DAY);
  const since30 = new Date(now.getTime() - 30 * DAY);
  const insights = await getAiInsightsData(businessSlug);

  const [appointments, invoices, products, services, staff, customers, payments] = await Promise.all([
    prisma.appointment.findMany({
      where: { businessId: business.id, startAt: { gte: now, lt: next14 }, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
      select: {
        id: true,
        startAt: true,
        status: true,
        price: true,
        customer: { select: { firstName: true, lastName: true } },
        service: { select: { name: true } },
        staffMember: { select: { displayName: true, user: { select: { name: true } } } },
        payments: { select: { amount: true, type: true, status: true } },
      },
      orderBy: { startAt: "asc" },
      take: 25,
    }),
    prisma.invoice.findMany({
      where: { businessId: business.id, status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] } },
      select: {
        invoiceNumber: true,
        total: true,
        amountPaid: true,
        status: true,
        dueDate: true,
        customer: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ dueDate: "asc" }, { issuedAt: "desc" }],
      take: 12,
    }),
    prisma.product.findMany({
      where: { businessId: business.id },
      select: { name: true, quantityOnHand: true, reorderThreshold: true, expiryDate: true },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
    prisma.service.findMany({
      where: { businessId: business.id, isActive: true },
      select: { name: true, price: true, durationMinutes: true },
      orderBy: { price: "desc" },
      take: 20,
    }),
    prisma.staffMember.findMany({
      where: { businessId: business.id, status: "ACTIVE" },
      select: { displayName: true, role: true, commissionType: true, commissionValue: true, user: { select: { name: true } } },
      take: 20,
    }),
    prisma.customer.findMany({
      where: { businessId: business.id, archivedAt: null },
      select: {
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        marketingOptInEmail: true,
        marketingOptInSms: true,
        marketingOptInWhatsapp: true,
        appointments: {
          where: { status: { not: "HOLD" } },
          select: { startAt: true, price: true },
          orderBy: { startAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.payment.findMany({
      where: { businessId: business.id, createdAt: { gte: since30 } },
      select: { amount: true, method: true, type: true, status: true, createdAt: true, customer: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const upcoming = appointments.map((appointment) => {
    const paid = paidForAppointment(appointment.payments);
    const price = Number(appointment.price);
    return {
      date: `${formatDayMonthInTz(appointment.startAt, business.timezone)} ${formatTimeInTz(appointment.startAt, business.timezone)}`,
      client: clientName(appointment.customer),
      service: appointment.service.name,
      staff: appointment.staffMember?.displayName || appointment.staffMember?.user?.name || "Unassigned",
      status: appointment.status,
      price: money(price, business.currency),
      paid: money(paid, business.currency),
      depositDue: money(depositDue(price, paid), business.currency),
    };
  });

  return {
    business: { name: business.name, currency: business.currency, timezone: business.timezone },
    summary: insights?.summary ?? "No insight summary available.",
    focus: insights?.focus ?? "No priority focus available.",
    moneyAtRisk: insights?.moneyAtRisk ?? money(0, business.currency),
    insights: insights?.insights ?? [],
    operationalData: {
      upcomingAppointments: upcoming,
      openInvoices: invoices.map((invoice) => ({
        invoiceNumber: invoice.invoiceNumber,
        client: clientName(invoice.customer),
        status: invoice.status,
        dueDate: invoice.dueDate ? formatDayMonthInTz(invoice.dueDate, business.timezone) : "No due date",
        balance: money(Math.max(0, Number(invoice.total) - Number(invoice.amountPaid)), business.currency),
      })),
      lowStock: products
        .filter((p) => p.reorderThreshold != null && Number(p.quantityOnHand) <= Number(p.reorderThreshold))
        .map((p) => ({ name: p.name, onHand: Number(p.quantityOnHand), threshold: Number(p.reorderThreshold) })),
      services: services.map((service) => ({
        name: service.name,
        price: money(Number(service.price), business.currency),
        durationMinutes: service.durationMinutes,
      })),
      staff: staff.map((member) => ({
        name: member.displayName || member.user?.name || "Unnamed staff",
        role: member.role,
        commission: member.commissionType === "NONE" ? "None" : `${member.commissionType} ${member.commissionValue ?? ""}`.trim(),
      })),
      recentClients: customers.map((customer) => ({
        name: clientName(customer),
        lastVisit: customer.appointments[0]?.startAt ? formatDayMonthInTz(customer.appointments[0].startAt, business.timezone) : "No visit recorded",
        reachableBy: [
          customer.marketingOptInWhatsapp && customer.phone ? "WhatsApp" : null,
          customer.marketingOptInSms && customer.phone ? "SMS" : null,
          customer.marketingOptInEmail && customer.email ? "email" : null,
        ].filter(Boolean),
      })),
      recentPayments: payments.map((payment) => ({
        client: clientName(payment.customer),
        amount: money(Number(payment.amount), business.currency),
        method: payment.method,
        type: payment.type,
        status: payment.status,
        date: formatDayMonthInTz(payment.createdAt, business.timezone),
      })),
    },
  };
}
