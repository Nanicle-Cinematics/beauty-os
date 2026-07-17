import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge, toneForStatus } from "@/components/ui";
import { getCalendarData } from "@/lib/calendar-data";
import { requireTenantAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

type CalendarPageProps = { params: Promise<{ businessSlug: string }> };

export default async function CalendarPage({ params }: CalendarPageProps) {
  const { businessSlug } = await params;
  await requireTenantAccess(businessSlug);
  const data = await getCalendarData(businessSlug);
  if (!data) notFound();

  return (
    <div className="grid gap-5">
      <PageHeader title="Calendar" description={`This week · ${data.totalBookings} booking${data.totalBookings === 1 ? "" : "s"}`}>
        <Link href={`/${businessSlug}/appointments`} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-plum to-wine px-4 py-2 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(84,33,63,0.28)]">
          <Plus size={16} /> New booking
        </Link>
      </PageHeader>

      <div className="grid gap-3 xl:grid-cols-7 lg:grid-cols-4 sm:grid-cols-2">
        {data.days.map((day) => (
          <div key={day.key} className={`card flex flex-col p-3.5 ${day.isToday ? "ring-2 ring-plum/25" : ""}`}>
            <div className="flex items-center justify-between gap-2 border-b border-line-2 pb-2.5">
              <div>
                <div className={`text-[12.5px] font-semibold ${day.isToday ? "text-plum" : "text-ink"}`}>
                  {day.label.split(",")[0]}
                </div>
                <div className="text-[11px] text-muted">{day.label.split(",")[1]?.trim()}</div>
              </div>
              {day.count > 0 ? (
                <span className="grid size-6 place-items-center rounded-full bg-plum-soft text-[11px] font-bold text-plum">{day.count}</span>
              ) : null}
            </div>

            {day.appts.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
                <CalendarDays size={18} className="text-faint" />
                <div className="mt-1.5 text-[11.5px] text-faint">No bookings</div>
              </div>
            ) : (
              <div className="mt-2.5 grid gap-2">
                {day.appts.map((appt) => (
                  <Link
                    key={appt.id}
                    href={`/${businessSlug}/appointments/${appt.id}`}
                    className="block rounded-xl border border-line-2 bg-plum-softer p-2.5 transition hover:border-plum-line hover:shadow-[var(--shadow-soft)]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-bold text-plum">{appt.time}</span>
                      <Badge tone={toneForStatus(appt.status)}>{appt.status}</Badge>
                    </div>
                    <div className="mt-1 truncate text-[12.5px] font-semibold text-ink">{appt.client}</div>
                    <div className="truncate text-[11.5px] text-muted">{appt.service}</div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted">
                      <span className="truncate">{appt.staff}</span>
                      <span className="font-semibold text-ink">{appt.value}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
