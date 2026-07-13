import "server-only";

import { prisma, isDatabaseConfigured } from "@/lib/prisma";

export type StaffRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  statusKey: "INVITED" | "ACTIVE" | "SUSPENDED" | "REMOVED";
  commission: string;
  services: number;
  bookings: number;
  revenue: string;
  colorHex: string;
  isSoleOwner: boolean;
};

export type StaffStat = { label: string; value: string; detail: string };
export type RoleOption = { value: string; label: string };

export type StaffModuleData = {
  tenant: { id: string; name: string; slug: string; currency: string };
  stats: StaffStat[];
  staff: StaffRow[];
  roles: RoleOption[];
};

export const BUSINESS_ROLES: RoleOption[] = [
  { value: "OWNER", label: "Owner" },
  { value: "MANAGER", label: "Manager" },
  { value: "RECEPTIONIST", label: "Receptionist" },
  { value: "SENIOR_ARTIST", label: "Senior artist" },
  { value: "ARTIST", label: "Artist" },
  { value: "CASHIER", label: "Cashier" },
  { value: "INVENTORY_OFFICER", label: "Inventory officer" },
];

const VALID_ROLES = new Set(BUSINESS_ROLES.map((role) => role.value));
const REALISED = new Set(["COMPLETED", "CONFIRMED"]);

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

/** A staff member has no name column until a User is linked; fall back to the
 * local part of the invited email so pending invites are still readable. */
function displayNameFromEmail(email: string) {
  const local = email.split("@")[0] ?? email;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || email;
}

function commissionLabel(type: string, value: number | null, currency: string) {
  if (type === "PERCENTAGE" && value != null) {
    return `${value}%`;
  }
  if (type === "FIXED" && value != null) {
    return money(value, currency);
  }
  return "—";
}

const fallbackStaffData: Record<string, StaffModuleData> = {
  "osu-glow-studio": {
    tenant: { id: "sample_osu_glow", name: "Osu Glow Studio", slug: "osu-glow-studio", currency: "GHS" },
    stats: [
      { label: "Active staff", value: "1", detail: "1 role" },
      { label: "Pending invites", value: "0", detail: "None outstanding" },
      { label: "Services covered", value: "3", detail: "By active staff" },
      { label: "Revenue generated", value: "GH₵ 1,850", detail: "Realised bookings" },
    ],
    staff: [
      { id: "demo-staff-1", name: "Nadia Mensah", email: "owner@osuglow.example", role: "Owner", status: "Active", statusKey: "ACTIVE", commission: "—", services: 3, bookings: 3, revenue: "GH₵ 1,850", colorHex: "#10b981", isSoleOwner: true },
    ],
    roles: BUSINESS_ROLES,
  },
  "luxe-lash-lab": {
    tenant: { id: "sample_luxe_lash", name: "Luxe Lash Lab", slug: "luxe-lash-lab", currency: "GHS" },
    stats: [
      { label: "Active staff", value: "1", detail: "1 role" },
      { label: "Pending invites", value: "0", detail: "None outstanding" },
      { label: "Services covered", value: "2", detail: "By active staff" },
      { label: "Revenue generated", value: "GH₵ 580", detail: "Realised bookings" },
    ],
    staff: [
      { id: "demo-staff-2", name: "Mina Owusu", email: "owner@luxelash.example", role: "Owner", status: "Active", statusKey: "ACTIVE", commission: "—", services: 2, bookings: 2, revenue: "GH₵ 580", colorHex: "#f43f5e", isSoleOwner: true },
    ],
    roles: BUSINESS_ROLES,
  },
};

export async function getStaffModuleData(businessSlug: string): Promise<StaffModuleData | null> {
  if (!isDatabaseConfigured()) {
    return fallbackStaffData[businessSlug] ?? null;
  }

  const business = await prisma.business.findUnique({
    where: { slug: businessSlug },
    select: { id: true, name: true, slug: true, currency: true },
  });

  if (!business) {
    return null;
  }

  const members = await prisma.staffMember.findMany({
    where: { businessId: business.id, status: { not: "REMOVED" } },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    include: {
      user: true,
      _count: { select: { assignedServices: true } },
      appointments: { select: { status: true, price: true } },
    },
  });

  const currency = business.currency;
  const activeOwnerCount = members.filter(
    (member) => member.role === "OWNER" && member.status === "ACTIVE",
  ).length;

  const staff: StaffRow[] = members.map((member) => {
    const email = member.user?.email ?? member.invitedEmail ?? "—";
    const realised = member.appointments.filter((appointment) => REALISED.has(appointment.status));
    const revenue = realised.reduce((sum, appointment) => sum + Number(appointment.price), 0);
    return {
      id: member.id,
      name: member.user?.name ?? (member.invitedEmail ? displayNameFromEmail(member.invitedEmail) : "Pending"),
      email,
      role: titleCase(member.role),
      status: titleCase(member.status),
      statusKey: member.status as StaffRow["statusKey"],
      commission: commissionLabel(
        member.commissionType,
        member.commissionValue != null ? Number(member.commissionValue) : null,
        currency,
      ),
      services: member._count.assignedServices,
      bookings: realised.length,
      revenue: money(revenue, currency),
      colorHex: member.colorHex ?? "#1d7b5d",
      isSoleOwner: member.role === "OWNER" && member.status === "ACTIVE" && activeOwnerCount === 1,
    };
  });

  const active = staff.filter((member) => member.statusKey === "ACTIVE");
  const pending = staff.filter((member) => member.statusKey === "INVITED");
  const roleSet = new Set(active.map((member) => member.role));
  const totalRevenue = members.reduce(
    (sum, member) =>
      sum +
      member.appointments
        .filter((appointment) => REALISED.has(appointment.status))
        .reduce((s, appointment) => s + Number(appointment.price), 0),
    0,
  );
  const servicesCovered = new Set(
    (
      await prisma.serviceStaff.findMany({
        where: { staffMember: { businessId: business.id, status: "ACTIVE" } },
        select: { serviceId: true },
      })
    ).map((link) => link.serviceId),
  ).size;

  const stats: StaffStat[] = [
    { label: "Active staff", value: String(active.length), detail: `${roleSet.size} ${roleSet.size === 1 ? "role" : "roles"}` },
    {
      label: "Pending invites",
      value: String(pending.length),
      detail: pending.length ? "Awaiting activation" : "None outstanding",
    },
    { label: "Services covered", value: String(servicesCovered), detail: "By active staff" },
    { label: "Revenue generated", value: money(totalRevenue, currency), detail: "Realised bookings" },
  ];

  return { tenant: business, stats, staff, roles: BUSINESS_ROLES };
}

export async function inviteStaff({
  businessSlug,
  email,
  role,
  commissionType,
  commissionValue,
  colorHex,
  bio,
}: {
  businessSlug: string;
  email: string;
  role: string;
  commissionType: string;
  commissionValue: number | null;
  colorHex: string;
  bio: string;
}) {
  if (!isDatabaseConfigured()) {
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !VALID_ROLES.has(role)) {
    return;
  }

  const business = await prisma.business.findUnique({
    where: { slug: businessSlug },
    select: { id: true },
  });

  if (!business) {
    return;
  }

  // Link an existing platform user if this email already has an account, so
  // activation immediately grants them workspace access.
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  // Don't create a duplicate membership for the same person in one business.
  const duplicate = await prisma.staffMember.findFirst({
    where: {
      businessId: business.id,
      status: { not: "REMOVED" },
      OR: [
        { invitedEmail: normalizedEmail },
        existingUser ? { userId: existingUser.id } : { id: "__none__" },
      ],
    },
    select: { id: true },
  });

  if (duplicate) {
    return;
  }

  const normalizedCommissionType = ["NONE", "PERCENTAGE", "FIXED"].includes(commissionType)
    ? commissionType
    : "NONE";

  await prisma.staffMember.create({
    data: {
      businessId: business.id,
      userId: existingUser?.id ?? null,
      invitedEmail: normalizedEmail,
      role: role as
        | "OWNER"
        | "MANAGER"
        | "RECEPTIONIST"
        | "SENIOR_ARTIST"
        | "ARTIST"
        | "CASHIER"
        | "INVENTORY_OFFICER",
      status: "INVITED",
      commissionType: normalizedCommissionType as "NONE" | "PERCENTAGE" | "FIXED",
      commissionValue:
        normalizedCommissionType !== "NONE" && commissionValue != null && commissionValue >= 0
          ? commissionValue
          : null,
      colorHex: colorHex || null,
      bio: bio.trim() || null,
    },
  });
}

export async function setStaffStatus({
  businessSlug,
  staffId,
  status,
}: {
  businessSlug: string;
  staffId: string;
  status: "ACTIVE" | "SUSPENDED" | "REMOVED";
}) {
  if (!isDatabaseConfigured()) {
    return;
  }

  const member = await prisma.staffMember.findFirst({
    where: { id: staffId, business: { slug: businessSlug } },
    select: { id: true, joinedAt: true, role: true },
  });

  if (!member) {
    return;
  }

  // Never let the last active OWNER be suspended/removed — a workspace must
  // always keep an owner who can manage it.
  if (status !== "ACTIVE" && member.role === "OWNER") {
    const otherOwners = await prisma.staffMember.count({
      where: {
        business: { slug: businessSlug },
        role: "OWNER",
        status: "ACTIVE",
        id: { not: member.id },
      },
    });
    if (otherOwners === 0) {
      return;
    }
  }

  await prisma.staffMember.update({
    where: { id: member.id },
    data: {
      status,
      joinedAt: status === "ACTIVE" && !member.joinedAt ? new Date() : member.joinedAt,
    },
  });
}
