import "server-only";

import { createHash, randomBytes } from "crypto";
import { prisma, tenantTransaction, isDatabaseConfigured } from "@/lib/prisma";
import { roleLabelForIndustry, roleOptionsForIndustry } from "@/lib/industry";
import type { BusinessRole } from "@prisma/client";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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

export type StaffDayHours = { dayOfWeek: number; startTime: string; endTime: string; isOff: boolean };

/** Every editable field on a staff member, plus what gates role/status changes. */
export type StaffDetail = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "INVITED" | "ACTIVE" | "SUSPENDED" | "REMOVED";
  bio: string;
  colorHex: string;
  commissionType: string;
  commissionValue: string;
  serviceIds: string[];
  hours: StaffDayHours[];
  /** True when this is the only active OWNER — their role and status are locked. */
  isSoleOwner: boolean;
  /** True when this member is the signed-in user — self role changes are refused. */
  isSelf: boolean;
  bookings: number;
  linkedToUser: boolean;
  categoryKey: string;
};

export type StaffWriteResult = { ok: true } | { ok: false; error: string };

export type InviteStaffResult =
  | { ok: true; inviteToken: string; businessId: string; businessName: string; email: string; name: string; roleLabel: string }
  | { ok: false; error: string };

export type StaffModuleData = {
  tenant: { id: string; name: string; slug: string; currency: string; categoryKey: string };
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

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

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

/** Fall back to the local part of the invited email so older pending invites
 * created before displayName are still readable. */
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

export async function getStaffModuleData(businessSlug: string): Promise<StaffModuleData | null> {
  // No demo fallback — inventing a team when the database is unreachable would
  // show a studio staff it doesn't employ. Caller 404s instead.
  if (!isDatabaseConfigured()) {
    return null;
  }

  const business = await prisma.business.findUnique({
    where: { slug: businessSlug },
    select: { id: true, name: true, slug: true, currency: true, category: { select: { key: true } } },
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
      name: member.user?.name ?? member.displayName ?? (member.invitedEmail ? displayNameFromEmail(member.invitedEmail) : "Pending"),
      email,
      role: roleLabelForIndustry(member.role, business.category.key),
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
      colorHex: member.colorHex ?? "#9d4e7a",
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

  return {
    tenant: { id: business.id, name: business.name, slug: business.slug, currency: business.currency, categoryKey: business.category.key },
    stats,
    staff,
    roles: roleOptionsForIndustry(BUSINESS_ROLES, business.category.key),
  };
}

export async function inviteStaff({
  businessSlug,
  name,
  email,
  role,
  commissionType,
  commissionValue,
  colorHex,
  bio,
}: {
  businessSlug: string;
  name: string;
  email: string;
  role: string;
  commissionType: string;
  commissionValue: number | null;
  colorHex: string;
  bio: string;
}): Promise<InviteStaffResult> {
  if (!isDatabaseConfigured()) {
    return { ok: false, error: "Database is not configured." };
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !VALID_ROLES.has(role)) {
    return { ok: false, error: "Enter a valid email and role." };
  }

  const business = await prisma.business.findUnique({
    where: { slug: businessSlug },
    select: { id: true, name: true, category: { select: { key: true } } },
  });

  if (!business) {
    return { ok: false, error: "Workspace not found." };
  }

  // Link an existing platform user if this email already has an account, so
  // activation immediately grants them workspace access.
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  const existingMember = await prisma.staffMember.findFirst({
    where: {
      businessId: business.id,
      OR: [
        { invitedEmail: normalizedEmail },
        existingUser ? { userId: existingUser.id } : { id: "__none__" },
      ],
    },
    select: { id: true, status: true },
  });

  if (existingMember && existingMember.status !== "REMOVED") {
    return { ok: false, error: "That person is already on this crew or has a pending invite." };
  }

  const normalizedCommissionType = ["NONE", "PERCENTAGE", "FIXED"].includes(commissionType)
    ? commissionType
    : "NONE";

  const inviteToken = randomBytes(32).toString("hex");
  const recipientName = name.trim() || displayNameFromEmail(normalizedEmail);
  const roleValue = role as BusinessRole;
  const roleLabel = roleLabelForIndustry(roleValue, business.category.key);

  await tenantTransaction(async (tx) => {
    const memberData = {
      businessId: business.id,
      userId: existingUser?.id ?? null,
      invitedEmail: normalizedEmail,
      displayName: recipientName,
      role: roleValue,
      status: "INVITED" as const,
      commissionType: normalizedCommissionType as "NONE" | "PERCENTAGE" | "FIXED",
      commissionValue:
        normalizedCommissionType !== "NONE" && commissionValue != null && commissionValue >= 0
          ? commissionValue
          : null,
      colorHex: colorHex || null,
      bio: bio.trim() || null,
    };

    if (existingMember) {
      await tx.staffMember.update({ where: { id: existingMember.id }, data: memberData });
    } else {
      await tx.staffMember.create({ data: memberData });
    }

    await tx.businessInvite.updateMany({
      where: { businessId: business.id, email: normalizedEmail, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await tx.businessInvite.create({
      data: {
        businessId: business.id,
        email: normalizedEmail,
        name: recipientName,
        role: roleValue,
        tokenHash: hashToken(inviteToken),
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    });
  }, { timeout: 15000 });

  return {
    ok: true,
    inviteToken,
    businessId: business.id,
    businessName: business.name,
    email: normalizedEmail,
    name: recipientName,
    roleLabel,
  };
}

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

/** Active services this business offers, for the staff assignment checklist. */
export async function getServiceOptionsForStaff(businessSlug: string): Promise<RoleOption[]> {
  if (!isDatabaseConfigured()) return [];
  const business = await prisma.business.findUnique({ where: { slug: businessSlug }, select: { id: true } });
  if (!business) return [];
  const services = await prisma.service.findMany({
    where: { businessId: business.id, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return services.map((s) => ({ value: s.id, label: s.name }));
}

export async function getStaffDetail(
  businessSlug: string,
  staffId: string,
  currentUserId: string,
): Promise<StaffDetail | null> {
  if (!isDatabaseConfigured()) return null;

  const member = await prisma.staffMember.findFirst({
    where: { id: staffId, business: { slug: businessSlug } },
    include: {
      user: true,
      business: { select: { category: { select: { key: true } } } },
      workingHours: true,
      assignedServices: { select: { serviceId: true } },
      _count: { select: { appointments: true } },
    },
  });
  if (!member) return null;

  const soleOwnerCheck =
    member.role === "OWNER" && member.status === "ACTIVE"
      ? await prisma.staffMember.count({
          where: { business: { slug: businessSlug }, role: "OWNER", status: "ACTIVE", id: { not: member.id } },
        })
      : 1; // not an active owner → the "sole owner" question doesn't apply

  const byDay = new Map(member.workingHours.map((h) => [h.dayOfWeek, h]));
  const hours: StaffDayHours[] = WEEKDAYS.map((d) => {
    const h = byDay.get(d);
    return {
      dayOfWeek: d,
      startTime: h?.startTime ?? "09:00",
      endTime: h?.endTime ?? "17:00",
      isOff: h?.isOff ?? true,
    };
  });

  return {
    id: member.id,
    name: member.user?.name ?? member.invitedEmail?.split("@")[0] ?? "Staff member",
    email: member.user?.email ?? member.invitedEmail ?? "",
    role: member.role,
    status: member.status,
    bio: member.bio ?? "",
    colorHex: member.colorHex ?? "#6d315f",
    commissionType: member.commissionType,
    commissionValue: member.commissionValue != null ? String(member.commissionValue) : "",
    serviceIds: member.assignedServices.map((s) => s.serviceId),
    hours,
    isSoleOwner: member.role === "OWNER" && member.status === "ACTIVE" && soleOwnerCheck === 0,
    isSelf: member.userId != null && member.userId === currentUserId,
    bookings: member._count.appointments,
    linkedToUser: member.userId != null,
    categoryKey: member.business.category.key,
  };
}

export async function updateStaffProfile(input: {
  businessSlug: string;
  staffId: string;
  bio: string;
  colorHex: string;
  commissionType: string;
  commissionValue: number | null;
  serviceIds: string[];
  hours: StaffDayHours[];
}): Promise<StaffWriteResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Database not configured" };

  const validTypes = ["NONE", "PERCENTAGE", "FIXED"];
  if (!validTypes.includes(input.commissionType)) return { ok: false, error: "Invalid commission type." };
  if (input.commissionType === "PERCENTAGE" && input.commissionValue != null && (input.commissionValue < 0 || input.commissionValue > 100)) {
    return { ok: false, error: "A percentage commission must be between 0 and 100." };
  }
  if (input.commissionType !== "NONE" && (input.commissionValue == null || input.commissionValue < 0)) {
    return { ok: false, error: "Enter a commission value." };
  }

  const member = await prisma.staffMember.findFirst({
    where: { id: input.staffId, business: { slug: input.businessSlug } },
    select: { id: true, businessId: true },
  });
  if (!member) return { ok: false, error: "That staff member no longer exists." };

  // Only this business's services may be assigned — never trust posted ids.
  const validServices = await prisma.service.findMany({
    where: { businessId: member.businessId, id: { in: input.serviceIds } },
    select: { id: true },
  });

  await tenantTransaction(
    async (tx) => {
      await tx.staffMember.update({
        where: { id: member.id },
        data: {
          bio: input.bio.trim() || null,
          colorHex: input.colorHex.trim() || null,
          commissionType: input.commissionType as "NONE" | "PERCENTAGE" | "FIXED",
          commissionValue: input.commissionType === "NONE" ? null : input.commissionValue,
        },
      });

      await tx.serviceStaff.deleteMany({ where: { staffMemberId: member.id } });
      if (validServices.length) {
        await tx.serviceStaff.createMany({
          data: validServices.map((s) => ({ staffMemberId: member.id, serviceId: s.id })),
          skipDuplicates: true,
        });
      }

      // Working hours upserted per weekday — the table is unique on (staff, day).
      for (const h of input.hours) {
        await tx.workingHours.upsert({
          where: { staffMemberId_dayOfWeek: { staffMemberId: member.id, dayOfWeek: h.dayOfWeek } },
          create: {
            staffMemberId: member.id,
            dayOfWeek: h.dayOfWeek,
            isOff: h.isOff,
            startTime: h.isOff ? null : h.startTime,
            endTime: h.isOff ? null : h.endTime,
          },
          update: {
            isOff: h.isOff,
            startTime: h.isOff ? null : h.startTime,
            endTime: h.isOff ? null : h.endTime,
          },
        });
      }
    },
    { timeout: 15000 },
  );

  return { ok: true };
}

/**
 * Change a staff member's role. The most dangerous write in the app — a role is
 * permission to act. Three guards, all server-side:
 *  - you cannot change your own role (no self-promotion, no self-demotion lockout);
 *  - you cannot demote the last active owner (the workspace must keep an owner);
 *  - the target role must be a real BusinessRole.
 */
export async function setStaffRole(input: {
  businessSlug: string;
  staffId: string;
  role: string;
  actingUserId: string;
}): Promise<StaffWriteResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Database not configured" };

  if (!BUSINESS_ROLES.some((r) => r.value === input.role)) return { ok: false, error: "Unknown role." };

  const member = await prisma.staffMember.findFirst({
    where: { id: input.staffId, business: { slug: input.businessSlug } },
    select: { id: true, role: true, status: true, userId: true },
  });
  if (!member) return { ok: false, error: "That staff member no longer exists." };

  if (member.userId && member.userId === input.actingUserId) {
    return { ok: false, error: "You can't change your own role. Ask another owner." };
  }

  // Demoting the last active owner would strand the workspace with no one who
  // can manage it.
  if (member.role === "OWNER" && input.role !== "OWNER") {
    const otherOwners = await prisma.staffMember.count({
      where: { business: { slug: input.businessSlug }, role: "OWNER", status: "ACTIVE", id: { not: member.id } },
    });
    if (otherOwners === 0) {
      return { ok: false, error: "This is the workspace's only owner. Make someone else an owner first." };
    }
  }

  if (member.role === input.role) return { ok: true };

  await prisma.staffMember.update({ where: { id: member.id }, data: { role: input.role as BusinessRole } });
  return { ok: true };
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
