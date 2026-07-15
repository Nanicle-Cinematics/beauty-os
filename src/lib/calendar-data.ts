import "server-only";

import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { money } from "@/lib/format";
import { zonedDayRange, formatTimeInTz, formatLongDateInTz } from "@/lib/date";

export type CalendarAppt = { id: string; time: string; client: string; service: string; staff: string; status: string; value: string };
export type CalendarDay = { key: string; label: string; isToday: boolean; count: number; appts: CalendarAppt[] };
export type CalendarData = { tenant: { name: string; currency: string }; weekLabel: string; totalBookings: number; days: CalendarDay[] };

const DAY = 24 * 60 * 60 * 1000;

function clientName(c: { firstName: string; lastName: string | null } | null) {
  if (!c) return "Walk-in";
  return [c.firstName, c.lastName].filter(Boolean).join(" ");
}

function titleCaseStatus(v: string) {
  return v.toLowerCase().split("_").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

export async function getCalendarData(businessSlug: string): Promise<CalendarData | null> {
  if (!isDatabaseConfigured()) return null;

  const business = await prisma.business.findUnique({ where: { slug: businessSlug } });
  if (!business) return null;

  const currency = business.currency;
  const tz = business.timezone || "UTC";
  const now = new Date();
  const { start: weekStart } = zonedDayRange(now, tz);
  const weekEnd = new Date(weekStart.getTime() + 7 * DAY);

  const appts = await prisma.appointment.findMany({
    where: { businessId: business.id, startAt: { gte: weekStart, lt: weekEnd } },
    orderBy: { startAt: "asc" },
    select: {
      id: true,
      startAt: true,
      status: true,
      price: true,
      customer: { select: { firstName: true, lastName: true } },
      service: { select: { name: true } },
      staffMember: { select: { user: { select: { name: true } }, invitedEmail: true } },
    },
  });

  const todayStart = weekStart.getTime();
  const days: CalendarDay[] = [];
  for (let i = 0; i < 7; i += 1) {
    const dayStart = new Date(weekStart.getTime() + i * DAY);
    const dayEnd = new Date(dayStart.getTime() + DAY);
    const inDay = appts.filter((a) => a.startAt >= dayStart && a.startAt < dayEnd);
    days.push({
      key: dayStart.toISOString(),
      label: formatLongDateInTz(dayStart, tz),
      isToday: dayStart.getTime() === todayStart,
      count: inDay.length,
      appts: inDay.map((a) => ({
        id: a.id,
        time: formatTimeInTz(a.startAt, tz),
        client: clientName(a.customer),
        service: a.service?.name ?? "—",
        staff: a.staffMember?.user?.name ?? a.staffMember?.invitedEmail?.split("@")[0] ?? "Unassigned",
        status: titleCaseStatus(a.status),
        value: money(Number(a.price), currency),
      })),
    });
  }

  return {
    tenant: { name: business.name, currency },
    weekLabel: `${formatLongDateInTz(weekStart, tz)} — ${formatLongDateInTz(new Date(weekEnd.getTime() - DAY), tz)}`,
    totalBookings: appts.length,
    days,
  };
}
