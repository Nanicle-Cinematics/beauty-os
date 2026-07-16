import "server-only";

import { addMinutes, format } from "@/lib/date";
import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { findOrCreateCustomer, findOrCreateService } from "@/lib/entity-resolve";

export type AppointmentRow = {
  id: string;
  time: string;
  client: string;
  service: string;
  staff: string;
  status: string;
  value: string;
};

export type AppointmentOption = {
  id: string;
  label: string;
};

export type AppointmentModuleData = {
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  appointments: AppointmentRow[];
  customers: AppointmentOption[];
  services: AppointmentOption[];
  staff: AppointmentOption[];
};

const fallbackAppointmentData: Record<string, AppointmentModuleData> = {
  "osu-glow-studio": {
    tenant: { id: "sample_osu_glow", name: "Osu Glow Studio", slug: "osu-glow-studio" },
    appointments: [
      { id: "demo-1", time: "09:00", client: "Ama Serwaa", service: "Silk press + trim", staff: "Nadia", status: "CONFIRMED", value: "GH₵ 420" },
      { id: "demo-2", time: "10:30", client: "Esi Manu", service: "Soft glam", staff: "Nadia", status: "PENDING", value: "GH₵ 650" },
      { id: "demo-3", time: "12:00", client: "Akua Mensah", service: "Wig install", staff: "Nadia", status: "PENDING", value: "GH₵ 780" },
    ],
    customers: [
      { id: "demo-customer-1", label: "Ama Serwaa" },
      { id: "demo-customer-2", label: "Esi Manu" },
      { id: "demo-customer-3", label: "Akua Mensah" },
    ],
    services: [
      { id: "demo-service-1", label: "Silk press + trim" },
      { id: "demo-service-2", label: "Soft glam" },
      { id: "demo-service-3", label: "Wig install" },
    ],
    staff: [{ id: "demo-staff-1", label: "Nadia Mensah" }],
  },
  "luxe-lash-lab": {
    tenant: { id: "sample_luxe_lash", name: "Luxe Lash Lab", slug: "luxe-lash-lab" },
    appointments: [
      { id: "demo-4", time: "09:00", client: "Yaa Boateng", service: "Classic lash set", staff: "Mina", status: "CONFIRMED", value: "GH₵ 360" },
      { id: "demo-5", time: "11:30", client: "Afia Owusu", service: "Brow lamination", staff: "Mina", status: "PENDING", value: "GH₵ 220" },
    ],
    customers: [
      { id: "demo-customer-4", label: "Yaa Boateng" },
      { id: "demo-customer-5", label: "Afia Owusu" },
    ],
    services: [
      { id: "demo-service-4", label: "Classic lash set" },
      { id: "demo-service-5", label: "Brow lamination" },
    ],
    staff: [{ id: "demo-staff-2", label: "Mina Owusu" }],
  },
};

function money(amount: { toString(): string }, currency = "GH₵") {
  return `${currency} ${Number(amount.toString()).toLocaleString("en-US")}`;
}

function readableStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function getAppointmentModuleData(businessSlug: string): Promise<AppointmentModuleData | null> {
  if (!isDatabaseConfigured()) {
    return fallbackAppointmentData[businessSlug] ?? null;
  }

  const business = await prisma.business.findUnique({
    where: { slug: businessSlug },
    select: { id: true, name: true, slug: true, currency: true },
  });

  if (!business) {
    return null;
  }

  const [appointments, customers, services, staff] = await Promise.all([
    prisma.appointment.findMany({
      where: { businessId: business.id },
      orderBy: { startAt: "asc" },
      include: {
        customer: true,
        service: true,
        staffMember: { include: { user: true } },
      },
    }),
    prisma.customer.findMany({
      where: { businessId: business.id },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.service.findMany({
      where: { businessId: business.id, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.staffMember.findMany({
      where: { businessId: business.id, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      include: { user: true },
    }),
  ]);

  return {
    tenant: business,
    appointments: appointments.map((appointment) => ({
      id: appointment.id,
      time: format(appointment.startAt),
      client: [appointment.customer.firstName, appointment.customer.lastName].filter(Boolean).join(" "),
      service: appointment.service.name,
      staff: appointment.staffMember?.user?.name ?? appointment.staffMember?.invitedEmail ?? "Unassigned",
      status: readableStatus(appointment.status),
      value: money(appointment.price, business.currency === "GHS" ? "GH₵" : business.currency),
    })),
    customers: customers.map((customer) => ({
      id: customer.id,
      label: [customer.firstName, customer.lastName].filter(Boolean).join(" "),
    })),
    services: services.map((service) => ({ id: service.id, label: service.name })),
    staff: staff.map((person) => ({
      id: person.id,
      label: person.user?.name ?? person.invitedEmail ?? "Staff member",
    })),
  };
}

export async function createAppointment({
  businessSlug,
  customer,
  service,
  staffMemberId,
  startAt,
  price,
}: {
  businessSlug: string;
  customer: string;
  service: string;
  staffMemberId: string;
  startAt: Date;
  price?: number | null;
}) {
  if (!isDatabaseConfigured()) {
    return;
  }

  const business = await prisma.business.findUnique({ where: { slug: businessSlug }, select: { id: true } });

  if (!business) {
    return;
  }

  const staffMember = await prisma.staffMember.findFirst({
    where: { id: staffMemberId, businessId: business.id, status: "ACTIVE" },
    select: { id: true },
  });
  if (!staffMember) {
    return;
  }

  // Client and service accept typed input: match an existing record by name, or
  // create one on the fly. An optional price overrides the booking price and, if
  // a new service is created, seeds its price (else a new service starts at
  // GH₵0 / 60 min to refine later; an existing service keeps its own price).
  const override = price != null && Number.isFinite(price) && price >= 0 ? price : undefined;
  const customerId = await findOrCreateCustomer(business.id, customer);
  const svc = await findOrCreateService(business.id, service, override);
  if (!customerId || !svc) {
    return;
  }

  await prisma.appointment.create({
    data: {
      businessId: business.id,
      customerId,
      serviceId: svc.id,
      staffMemberId: staffMember.id,
      startAt,
      endAt: addMinutes(startAt, svc.durationMinutes),
      status: "CONFIRMED",
      source: "ADMIN",
      price: override != null ? override : svc.price,
      depositAmount: svc.depositAmount,
      depositPaid: Boolean(svc.depositAmount),
    },
  });
}

export async function updateAppointmentStatus({
  businessSlug,
  appointmentId,
  status,
}: {
  businessSlug: string;
  appointmentId: string;
  status: "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
}) {
  if (!isDatabaseConfigured()) {
    return;
  }

  await prisma.appointment.updateMany({
    where: {
      id: appointmentId,
      business: { slug: businessSlug },
    },
    data: {
      status,
      cancelledAt: status === "CANCELLED" ? new Date() : null,
    },
  });
}
