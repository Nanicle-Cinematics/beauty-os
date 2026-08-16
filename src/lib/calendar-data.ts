import "server-only";

import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { money } from "@/lib/format";
import { zonedDayRange, formatTimeInTz, formatLongDateInTz } from "@/lib/date";

export type CalendarAppt = {
  id: string;
  time: string;
  timeRange: string;
  client: string;
  service: string;
  staff: string;
  status: string;
  value: string;
  color: string;
};
export type CalendarDay = {
  key: string;
  label: string;
  dayName: string;
  dateNumber: string;
  monthShort: string;
  isToday: boolean;
  count: number;
  appts: CalendarAppt[];
};
export type CalendarData = { tenant: { name: string; currency: string }; weekLabel: string; totalBookings: number; days: CalendarDay[] };

const DAY = 24 * 60 * 60 * 1000;

const fallbackTenants: Record<string, { name: string; currency: string }> = {
  "osu-glow-studio": { name: "Osu Glow Studio", currency: "GHS" },
  "luxe-lash-lab": { name: "Luxe Lash Lab", currency: "GHS" },
};

const fallbackAppointments: Record<string, Array<Omit<CalendarAppt, "time" | "timeRange"> & { day: number; time: string }>> = {
  "osu-glow-studio": [
    { id: "demo-1", day: 0, time: "09:00", client: "Ama Serwaa", service: "Silk press + trim", staff: "Nadia", status: "Confirmed", value: "GH₵ 420", color: "#8b5cf6" },
    { id: "demo-2", day: 0, time: "10:30", client: "Esi Manu", service: "Soft glam", staff: "Nadia", status: "Pending", value: "GH₵ 650", color: "#db2777" },
    { id: "demo-3", day: 0, time: "12:00", client: "Akua Mensah", service: "Wig install", staff: "Nadia", status: "Hold", value: "GH₵ 780", color: "#6d315f" },
    { id: "demo-4", day: 2, time: "14:00", client: "Yvonne Boateng", service: "Bridal trial", staff: "Nadia", status: "Confirmed", value: "GH₵ 580", color: "#c084fc" },
  ],
  "luxe-lash-lab": [
    { id: "demo-5", day: 0, time: "09:00", client: "Yaa Boateng", service: "Classic lash set", staff: "Mina", status: "Confirmed", value: "GH₵ 360", color: "#7c3aed" },
    { id: "demo-6", day: 0, time: "11:30", client: "Afia Owusu", service: "Brow lamination", staff: "Mina", status: "Pending", value: "GH₵ 220", color: "#be185d" },
    { id: "demo-7", day: 3, time: "15:00", client: "Efe Mensah", service: "Lash refill", staff: "Mina", status: "Confirmed", value: "GH₵ 220", color: "#0f766e" },
  ],
};

function clientName(c: { firstName: string; lastName: string | null } | null) {
  if (!c) return "Walk-in";
  return [c.firstName, c.lastName].filter(Boolean).join(" ");
}

function titleCaseStatus(v: string) {
  return v.toLowerCase().split("_").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

function dayMeta(date: Date, tz: string) {
  return {
    dayName: new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: tz }).format(date),
    dateNumber: new Intl.DateTimeFormat("en-GB", { day: "2-digit", timeZone: tz }).format(date),
    monthShort: new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: tz }).format(date),
  };
}

function startOfWeek(date: Date, tz: string) {
  const { start } = zonedDayRange(date, tz);
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: tz }).format(start);
  const index = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  const daysSinceMonday = index < 0 ? 0 : (index + 6) % 7;
  return new Date(start.getTime() - daysSinceMonday * DAY);
}

export async function getCalendarData(businessSlug: string, anchorDate = new Date()): Promise<CalendarData | null> {
  if (!isDatabaseConfigured()) {
    const tenant = fallbackTenants[businessSlug];
    if (!tenant) return null;

    const tz = "Africa/Accra";
    const weekStart = startOfWeek(anchorDate, tz);
    const { start: todayStart } = zonedDayRange(new Date(), tz);
    const days: CalendarDay[] = [];
    for (let i = 0; i < 28; i += 1) {
      const dayStart = new Date(weekStart.getTime() + i * DAY);
      const appts = (fallbackAppointments[businessSlug] ?? []).filter((a) => a.day === i);
      const meta = dayMeta(dayStart, tz);
      days.push({
        key: dayStart.toISOString(),
        label: formatLongDateInTz(dayStart, tz),
        ...meta,
        isToday: dayStart.getTime() === todayStart.getTime(),
        count: appts.length,
        appts: appts.map((appt) => ({
          id: appt.id,
          time: appt.time,
          timeRange: appt.time,
          client: appt.client,
          service: appt.service,
          staff: appt.staff,
          status: appt.status,
          value: appt.value,
          color: appt.color,
        })),
      });
    }

    return {
      tenant,
      weekLabel: `${formatLongDateInTz(weekStart, tz)} — ${formatLongDateInTz(new Date(weekStart.getTime() + 27 * DAY), tz)}`,
      totalBookings: days.reduce((sum, day) => sum + day.count, 0),
      days,
    };
  }

  const business = await prisma.business.findUnique({ where: { slug: businessSlug } });
  if (!business) return null;

  const currency = business.currency;
  const tz = business.timezone || "UTC";
  const weekStart = startOfWeek(anchorDate, tz);
  const weekEnd = new Date(weekStart.getTime() + 28 * DAY);

  const appts = await prisma.appointment.findMany({
    where: { businessId: business.id, startAt: { gte: weekStart, lt: weekEnd } },
    orderBy: { startAt: "asc" },
    select: {
      id: true,
      startAt: true,
      status: true,
      price: true,
      customer: { select: { firstName: true, lastName: true } },
      service: { select: { name: true, colorHex: true } },
      endAt: true,
      staffMember: { select: { user: { select: { name: true } }, invitedEmail: true } },
    },
  });

  const { start: realTodayStart } = zonedDayRange(new Date(), tz);
  const days: CalendarDay[] = [];
  for (let i = 0; i < 28; i += 1) {
    const dayStart = new Date(weekStart.getTime() + i * DAY);
    const dayEnd = new Date(dayStart.getTime() + DAY);
    const inDay = appts.filter((a) => a.startAt >= dayStart && a.startAt < dayEnd);
    const meta = dayMeta(dayStart, tz);
    days.push({
      key: dayStart.toISOString(),
      label: formatLongDateInTz(dayStart, tz),
      ...meta,
      isToday: dayStart.getTime() === realTodayStart.getTime(),
      count: inDay.length,
      appts: inDay.map((a) => ({
        id: a.id,
        time: formatTimeInTz(a.startAt, tz),
        timeRange: `${formatTimeInTz(a.startAt, tz)} - ${formatTimeInTz(a.endAt, tz)}`,
        client: clientName(a.customer),
        service: a.service?.name ?? "—",
        staff: a.staffMember?.user?.name ?? a.staffMember?.invitedEmail?.split("@")[0] ?? "Unassigned",
        status: titleCaseStatus(a.status),
        value: money(Number(a.price), currency),
        color: a.service?.colorHex || "#6d315f",
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
