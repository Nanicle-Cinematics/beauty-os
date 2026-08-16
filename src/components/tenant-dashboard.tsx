import Link from "next/link";
import {
  Wallet,
  CalendarCheck,
  Users,
  TriangleAlert,
  ArrowUpRight,
  ArrowRight,
  Clock,
  CheckCircle2,
  Sparkles,
  ListChecks,
  Cake,
  Coins,
  CalendarPlus,
  UserPlus,
  ReceiptText,
} from "lucide-react";
import { Badge } from "@/components/ui";
import type { TenantDashboardData, DashStat, QueuePriority } from "@/lib/dashboard-data";

type TenantDashboardProps = {
  data: TenantDashboardData;
  businessSlug: string;
};

const statIcon: Record<string, typeof Wallet> = {
  rose: Wallet,
  teal: CalendarCheck,
  blue: Users,
  amber: TriangleAlert,
};

const statAccent: Record<string, string> = {
  rose: "bg-plum-soft text-plum",
  teal: "bg-success-soft text-success",
  blue: "bg-aqua/12 text-[#236f89]",
  amber: "bg-warning-soft text-warning",
};

function statusTone(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("complete")) return "bg-success-soft text-success";
  if (s.includes("cancel") || s.includes("no")) return "bg-danger-soft text-danger";
  if (s.includes("pending") || s.includes("wait")) return "bg-warning-soft text-warning";
  if (s.includes("service") || s.includes("checked")) return "bg-aqua/12 text-[#236f89]";
  return "bg-plum-soft text-plum";
}

/**
 * Queue priority styling. Urgent reads as money leaving the building, watch as a
 * note to self — the difference has to be legible at a glance from behind a desk.
 */
const queueTone: Record<QueuePriority, { chip: string; rail: string; label: string }> = {
  urgent: { chip: "bg-danger-soft text-danger", rail: "bg-danger", label: "Urgent" },
  soon: { chip: "bg-warning-soft text-warning", rail: "bg-warning", label: "Soon" },
  watch: { chip: "bg-plum-soft text-plum", rail: "bg-mauve", label: "Watch" },
};

function StatCard({ stat }: { stat: DashStat }) {
  const Icon = statIcon[stat.tone] ?? Coins;
  return (
    <article className="card p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-muted">{stat.label}</span>
        <span className={`icon-chip grid size-9 place-items-center rounded-2xl ${statAccent[stat.tone] ?? "bg-plum-soft text-plum"}`}>
          <Icon size={16} />
        </span>
      </div>
      <div className="mt-3 text-[26px] font-semibold tracking-tight text-ink">{stat.value}</div>
      <div className="mt-1 text-[12.5px] font-medium text-muted">{stat.detail}</div>
    </article>
  );
}

export function TenantDashboard({ data, businessSlug }: TenantDashboardProps) {
  const { hero, secondary, stats, pills, queue, timeline } = data;
  const urgentCount = queue.filter((item) => item.priority === "urgent").length;
  const visibleStats = stats.filter((stat) => stat.label !== "Client retention").slice(0, 3);

  // When there's nothing to chase, say what IS true rather than showing a void.
  const calmSummary = (() => {
    const bits: string[] = [];
    if (secondary.returningToday > 0) {
      bits.push(`${secondary.returningToday} returning ${secondary.returningToday === 1 ? "client" : "clients"} today`);
    }
    if (secondary.busiest) bits.push(`busiest ${secondary.busiest}`);
    bits.push(`${secondary.freeCapacity} still open`);
    return `${secondary.bookedValue} booked · ${bits.join(" · ")}.`;
  })();

  const pillIcon = (pill: string) => {
    const p = pill.toLowerCase();
    if (p.includes("deposit") || p.includes("unpaid")) return Coins;
    if (p.includes("birthday")) return Cake;
    return Clock;
  };
  const quickActions = [
    { label: "New booking", href: `/${businessSlug}/appointments?new=1#new-booking`, icon: CalendarPlus },
    { label: "Add client", href: `/${businessSlug}/clients?new=1#add-client`, icon: UserPlus },
    { label: "Record payment", href: `/${businessSlug}/payments?new=1#record-payment`, icon: Coins },
    { label: "New invoice", href: `/${businessSlug}/invoices/new`, icon: ReceiptText },
  ];

  return (
    <div className="animate-fade-up grid gap-5">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.label}
              href={action.href}
              className="glass-panel flex min-h-20 flex-col items-center justify-center gap-2 rounded-[24px] px-4 py-4 text-center text-[14px] font-semibold text-ink transition hover:border-plum-line hover:bg-white/65 hover:text-plum sm:min-h-24"
            >
              <span className="icon-chip grid size-10 place-items-center rounded-[18px] bg-plum-soft text-plum">
                <Icon size={20} />
              </span>
              <span className="truncate">{action.label}</span>
            </Link>
          );
        })}
      </section>

      {/* Command row: daily summary + Front Desk Queue */}
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,0.85fr)]">
        <div className="brand-dark relative overflow-hidden rounded-[var(--radius-card)] text-white shadow-[var(--shadow-lift)]">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_30%),radial-gradient(circle_at_82%_8%,rgba(255,255,255,0.18),transparent_15rem)]" />
          <div className="absolute right-6 top-6 hidden h-28 w-28 rounded-[36px] border border-white/15 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] backdrop-blur-xl md:block" />
          <div className="absolute right-20 top-20 hidden h-24 w-24 rounded-[32px] border border-white/10 bg-aqua/15 backdrop-blur-xl md:block" />
          <div className="relative flex min-h-[260px] flex-col justify-between gap-8 p-6 md:p-7">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/14 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/78 backdrop-blur">
                <Sparkles size={12} /> {data.todayLabel}
              </div>
              <h2 className="max-w-2xl font-serif text-[32px] font-semibold leading-[1.1] tracking-tight md:text-[38px]">
                {hero.headline}
              </h2>
              <p className="mt-3 max-w-xl text-[14px] leading-6 text-white/68">{hero.sub}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {pills.map((pill) => {
                const PillIcon = pillIcon(pill);
                return (
                  <span key={pill} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.12] px-3 py-1.5 text-[12px] font-medium text-white/86 backdrop-blur">
                    <PillIcon size={13} className="text-aqua" /> {pill}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        <div className="card flex flex-col p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-[15px] font-semibold">
                <ListChecks size={17} className="text-plum" /> Front desk queue
              </h2>
              <p className="mt-0.5 text-[12.5px] text-muted">Tasks that need a decision.</p>
            </div>
            {urgentCount > 0 ? (
              <span className="rounded-full bg-danger-soft px-2.5 py-1 text-[11px] font-semibold text-danger">
                {urgentCount} urgent
              </span>
            ) : queue.length > 0 ? (
              <span className="rounded-full bg-warning-soft px-2.5 py-1 text-[11px] font-semibold text-warning">
                {queue.length} open
              </span>
            ) : null}
          </div>
          {queue.length === 0 ? (
            // Calm state, not an empty one: say what's true rather than showing a void.
            <div className="glass-panel mt-5 flex flex-1 flex-col items-center justify-center rounded-[26px] border-dashed px-4 py-8 text-center">
              <span className="icon-chip grid size-12 place-items-center rounded-[22px] bg-success-soft text-success">
                <CheckCircle2 size={20} />
              </span>
              <div className="mt-3 text-[13.5px] font-semibold text-ink">Nothing needs a decision</div>
              <p className="mt-1 text-[12.5px] leading-5 text-muted">{calmSummary}</p>
            </div>
          ) : (
            <div className="mt-4 grid gap-2.5">
              {queue.map((item) => {
                const tone = queueTone[item.priority];
                return (
                  <article
                    key={item.id}
                    className="relative overflow-hidden rounded-[20px] border border-white/55 bg-white/45 p-3 pl-4 transition hover:border-plum-line hover:bg-white/68 hover:shadow-[var(--shadow-soft)]"
                  >
                    <span className={`absolute inset-y-0 left-0 w-1 ${tone.rail}`} aria-hidden />
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-[13px] font-semibold leading-5 text-ink">{item.title}</h3>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone.chip}`}>
                        {tone.label}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] leading-5 text-muted">{item.body}</p>
                    <Link
                      href={`/${businessSlug}/${item.action.path}`}
                      className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-plum hover:gap-1.5"
                    >
                      {item.action.label} <ArrowRight size={12} />
                    </Link>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* KPI row */}
      <section className="grid gap-4 sm:grid-cols-3">
        {visibleStats.map((stat) => (
          <StatCard key={stat.label} stat={stat} />
        ))}
      </section>

      {/* Schedule */}
      <section>
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold">Next up today</h2>
              <p className="mt-0.5 text-[12.5px] text-muted">What&apos;s left of the day, in order — including the gaps.</p>
            </div>
            <Link href={`/${businessSlug}/calendar`} className="inline-flex items-center gap-1 rounded-2xl border border-white/65 bg-white/45 px-3 py-2 text-[12.5px] font-semibold text-ink hover:bg-white/70">
              Calendar <ArrowUpRight size={14} />
            </Link>
          </div>
          {timeline.length === 0 ? (
            <div className="glass-panel flex flex-col items-center justify-center rounded-[26px] border-dashed px-4 py-10 text-center">
              <span className="icon-chip grid size-12 place-items-center rounded-[22px] bg-plum-soft text-plum">
                <CalendarCheck size={20} />
              </span>
              <div className="mt-3 text-[13.5px] font-semibold">Nothing left today</div>
              <p className="mt-1 text-[12.5px] text-muted">The rest of the day is clear.</p>
              <Link href={`/${businessSlug}/appointments`} className="primary-action mt-4 rounded-2xl px-4 py-2 text-[12.5px] font-semibold text-white">
                Create booking
              </Link>
            </div>
          ) : (
            // Cards rather than a table: this reads on a phone at the front desk,
            // and a gap row has no business pretending to be a table row.
            <ol className="grid gap-2">
              {timeline.map((entry) =>
                entry.kind === "gap" ? (
                  <li
                    key={entry.id}
                    className="flex items-center gap-3 rounded-[20px] border border-dashed border-line bg-white/38 px-4 py-2.5"
                  >
                    <Clock size={13} className="shrink-0 text-faint" />
                    <span className="text-[12px] font-semibold text-muted">{entry.label}</span>
                    <span className="text-[11.5px] text-faint">{entry.detail}</span>
                  </li>
                ) : (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[20px] border border-white/55 bg-white/45 px-4 py-3 transition hover:border-plum-line hover:bg-white/68"
                  >
                    <span className="w-[52px] shrink-0 text-[13px] font-semibold text-plum">{entry.time}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-ink">{entry.client}</div>
                      <div className="mt-0.5 truncate text-[12px] text-muted">
                        {entry.service} · {entry.staff}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusTone(entry.status)}`}>
                      {entry.status}
                    </span>
                    <Badge tone={entry.pay.tone}>{entry.pay.label}</Badge>
                    <span className="w-[76px] shrink-0 text-right text-[13px] font-semibold text-ink">{entry.value}</span>
                  </li>
                ),
              )}
            </ol>
          )}
        </div>
      </section>
    </div>
  );
}
