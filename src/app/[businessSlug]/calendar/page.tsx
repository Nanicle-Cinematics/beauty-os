import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Plus, UserRound } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { getCalendarData } from "@/lib/calendar-data";
import { requireTenantAccess } from "@/lib/auth";
import { timeDataLoad } from "@/lib/perf";

export const dynamic = "force-dynamic";

type CalendarPageProps = {
  params: Promise<{ businessSlug: string }>;
  searchParams: Promise<{ date?: string }>;
};

function parseAnchorDate(value: string | undefined) {
  if (!value) return new Date();
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function dateParam(date: Date) {
  return date.toISOString().slice(0, 10);
}

const DAY_COLORS = [
  { bg: "#fff3c4", border: "#f2cf63", accent: "#8a6415", head: "#f7d956" },
  { bg: "#e6f6f1", border: "#8fd2c1", accent: "#24745f", head: "#a6ead8" },
  { bg: "#eef0ff", border: "#b7bdf7", accent: "#535fb7", head: "#c8ccff" },
  { bg: "#ffeaf2", border: "#f2a8c4", accent: "#a53365", head: "#ffc2d8" },
  { bg: "#ecf7ff", border: "#9fd4f5", accent: "#266f9e", head: "#bae4ff" },
  { bg: "#f4edff", border: "#cbb0f5", accent: "#6c3fa3", head: "#d9c5ff" },
  { bg: "#fff0df", border: "#f0bd81", accent: "#9a5a19", head: "#ffd1a0" },
];

export default async function CalendarPage({ params, searchParams }: CalendarPageProps) {
  const { businessSlug } = await params;
  const { date } = await searchParams;
  const anchorDate = parseAnchorDate(date);
  await requireTenantAccess(businessSlug);
  const data = await timeDataLoad(`calendar:${businessSlug}`, () => getCalendarData(businessSlug, anchorDate));
  if (!data) notFound();
  const busiestDay = data.days.reduce((best, day) => (day.count > best.count ? day : best), data.days[0]);
  const today = data.days.find((day) => day.isToday) ?? data.days[0];
  const firstDay = new Date(data.days[0]?.key ?? anchorDate.toISOString());
  const previousPeriod = new Date(firstDay.getTime() - 28 * 24 * 60 * 60 * 1000);
  const nextPeriod = new Date(firstDay.getTime() + 28 * 24 * 60 * 60 * 1000);
  const weeks = Array.from({ length: 4 }, (_, weekIndex) => data.days.slice(weekIndex * 7, weekIndex * 7 + 7));

  return (
    <div className="grid gap-5">
      <PageHeader title="Calendar" description={`${data.weekLabel} · ${data.totalBookings} booking${data.totalBookings === 1 ? "" : "s"}`}>
        <Link href={`/${businessSlug}/appointments`} className="primary-action inline-flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white">
          <Plus size={16} /> New booking
        </Link>
      </PageHeader>

      <section className="glass-panel overflow-hidden rounded-[30px]">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[22px] font-semibold tracking-tight text-ink">4-week planner</h2>
              <span className="primary-action rounded-full px-3 py-1 text-[11px] font-semibold text-white">Today</span>
            </div>
            <p className="mt-1 text-sm font-medium text-muted">{data.tenant.name} · {data.weekLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/${businessSlug}/calendar?date=${dateParam(previousPeriod)}`} className="grid size-10 place-items-center rounded-[18px] border border-white/65 bg-white/55 text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] hover:bg-white/75" aria-label="Previous four weeks">
              <ChevronLeft size={17} />
            </Link>
            <Link href={`/${businessSlug}/calendar?date=${dateParam(nextPeriod)}`} className="grid size-10 place-items-center rounded-[18px] border border-white/65 bg-white/55 text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] hover:bg-white/75" aria-label="Next four weeks">
              <ChevronRight size={17} />
            </Link>
            <div className="ml-1 grid grid-cols-3 rounded-[20px] border border-white/65 bg-white/48 p-1 text-[12px] font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
              <span className="primary-action rounded-2xl px-4 py-2 text-white">4 weeks</span>
              <span className="px-4 py-2">Week</span>
              <span className="px-4 py-2">Day</span>
            </div>
          </div>
        </div>

        <div className="grid gap-3 border-y border-white/65 bg-white/30 px-5 py-4 sm:grid-cols-3 sm:px-6">
          <div className="rounded-[22px] border border-white/70 bg-white/56 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">This period</div>
            <div className="mt-1 text-[22px] font-semibold text-ink">{data.totalBookings}</div>
            <div className="text-[12px] font-medium text-muted">Bookings scheduled</div>
          </div>
          <div className="rounded-[22px] border border-white/70 bg-white/56 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Today</div>
            <div className="mt-1 text-[22px] font-semibold text-ink">{today?.count ?? 0}</div>
            <div className="text-[12px] font-medium text-muted">{today?.label ?? "No date"}</div>
          </div>
          <div className="rounded-[22px] border border-white/70 bg-white/56 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Busiest day</div>
            <div className="mt-1 text-[22px] font-semibold text-ink">{busiestDay?.dayName ?? "—"}</div>
            <div className="text-[12px] font-medium text-muted">{busiestDay?.count ?? 0} booking{busiestDay?.count === 1 ? "" : "s"}</div>
          </div>
        </div>

        <div className="overflow-x-auto px-4 py-4 sm:px-6">
          <div className="min-w-[980px]">
            <div className="grid grid-cols-7 gap-2 px-1 pb-2">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, index) => (
                <div
                  key={day}
                  className="rounded-[18px] px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.12em] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]"
                  style={{ backgroundColor: DAY_COLORS[index].head, color: DAY_COLORS[index].accent }}
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid gap-2">
              {weeks.map((week, weekIndex) => (
                <div key={`week-${weekIndex}`} className="grid grid-cols-7 gap-2">
                  {week.map((day, dayIndex) => {
                    const color = DAY_COLORS[dayIndex % DAY_COLORS.length];
                    return (
                    <div
                      key={day.key}
                      className={`min-h-[132px] rounded-[24px] border p-2.5 transition hover:-translate-y-0.5 ${
                        day.isToday
                          ? "border-ink bg-ink text-white shadow-[0_18px_38px_rgba(35,28,34,0.22)]"
                          : "text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_10px_24px_rgba(84,33,63,0.07)]"
                      }`}
                      style={day.isToday ? undefined : { backgroundColor: color.bg, borderColor: color.border }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div
                            className={`text-[11px] font-semibold ${day.isToday ? "text-white/70" : ""}`}
                            style={day.isToday ? undefined : { color: color.accent }}
                          >
                            {day.monthShort}
                          </div>
                          <div className="text-[24px] font-semibold leading-none tracking-tight">{day.dateNumber}</div>
                        </div>
                        {day.count > 0 ? (
                          <span
                            className={`grid size-6 place-items-center rounded-full text-[11px] font-bold ${day.isToday ? "bg-white text-ink" : ""}`}
                            style={day.isToday ? undefined : { backgroundColor: color.head, color: color.accent }}
                          >
                            {day.count}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-2 grid gap-1.5">
                        {day.appts.length === 0 ? (
                          <div
                            className={`flex min-h-[58px] items-center justify-center rounded-[18px] border border-dashed px-2 text-[11.5px] font-semibold ${day.isToday ? "border-white/25 text-white/55" : ""}`}
                            style={day.isToday ? undefined : { borderColor: color.border, color: color.accent }}
                          >
                            <CalendarDays size={14} className="mr-1.5" /> Open
                          </div>
                        ) : (
                          <>
                            {day.appts.slice(0, 3).map((appt) => (
                              <Link
                                key={appt.id}
                                href={`/${businessSlug}/appointments/${appt.id}`}
                                style={day.isToday ? undefined : { backgroundColor: `${appt.color}14`, borderColor: `${appt.color}44` }}
                                className={`block rounded-[18px] border px-2.5 py-2 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] ${
                                  day.isToday ? "border-white/15 bg-white/10 text-white" : "text-ink"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1.5">
                                  <span className={`flex items-center gap-1 truncate text-[10.5px] font-bold ${day.isToday ? "text-white/70" : "text-muted"}`}>
                                    <Clock size={10} /> {appt.time}
                                  </span>
                                  <span className={`size-2 shrink-0 rounded-full ${day.isToday ? "bg-white" : ""}`} style={day.isToday ? undefined : { backgroundColor: appt.color }} />
                                </div>
                                <div className="mt-0.5 truncate text-[12px] font-semibold">{appt.client}</div>
                                <div className={`truncate text-[10.5px] font-medium ${day.isToday ? "text-white/60" : "text-muted"}`}>{appt.service}</div>
                                <div className={`mt-1 flex items-center justify-between gap-2 text-[10.5px] ${day.isToday ? "text-white/60" : "text-muted"}`}>
                                  <span className="flex min-w-0 items-center gap-1 truncate"><UserRound size={10} /> {appt.staff}</span>
                                  <span className={`font-bold ${day.isToday ? "text-white" : "text-ink"}`}>{appt.value}</span>
                                </div>
                              </Link>
                            ))}
                            {day.appts.length > 3 ? (
                              <div className={`rounded-2xl px-2 py-1 text-[10.5px] font-semibold ${day.isToday ? "bg-white/10 text-white/70" : "bg-white/45 text-muted"}`}>
                                +{day.appts.length - 3} more
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
