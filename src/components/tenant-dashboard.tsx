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
  Package,
  Cake,
  Coins,
  TrendingUp,
} from "lucide-react";
import { TrendChart } from "@/components/trend-chart";
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
  blue: "bg-[#eef1f6] text-[#4a5b7a]",
  amber: "bg-warning-soft text-warning",
};

function statusTone(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("complete")) return "bg-success-soft text-success";
  if (s.includes("cancel") || s.includes("no")) return "bg-danger-soft text-danger";
  if (s.includes("pending") || s.includes("wait")) return "bg-warning-soft text-warning";
  if (s.includes("service") || s.includes("checked")) return "bg-[#eef1f6] text-[#4a5b7a]";
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
    <article className="card p-5 transition hover:shadow-[var(--shadow-lift)]">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-muted">{stat.label}</span>
        <span className={`grid size-8 place-items-center rounded-xl ${statAccent[stat.tone] ?? "bg-plum-soft text-plum"}`}>
          <Icon size={16} />
        </span>
      </div>
      <div className="mt-3 text-[26px] font-semibold tracking-tight text-ink">{stat.value}</div>
      <div className="mt-1 text-[12.5px] font-medium text-muted">{stat.detail}</div>
    </article>
  );
}

export function TenantDashboard({ data, businessSlug }: TenantDashboardProps) {
  const { hero, secondary, stats, pulse, pills, queue, timeline, clientSignals, staff, inventory } = data;
  const urgentCount = queue.filter((item) => item.priority === "urgent").length;

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

  return (
    <div className="animate-fade-up grid gap-5">
      {/* Command row: Studio Pulse + Front Desk Queue */}
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,0.85fr)]">
        <div className="relative overflow-hidden rounded-[var(--radius-card)] text-white shadow-[var(--shadow-lift)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_-10%,rgba(198,120,155,0.32),transparent_16rem),linear-gradient(135deg,#1d1220,#2a172b_55%,#54213f)]" />
          <div className="relative grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_220px] md:p-7">
            <div className="flex flex-col justify-between gap-6">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-rose">
                  <Sparkles size={12} /> {data.todayLabel}
                </div>
                <h2 className="font-serif text-[30px] font-semibold leading-[1.1] tracking-tight md:text-[34px]">
                  {hero.headline}
                </h2>
                <p className="mt-3 max-w-md text-[13.5px] leading-6 text-white/65">{hero.sub}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {pills.map((pill) => {
                  const PillIcon = pillIcon(pill);
                  return (
                    <span key={pill} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.09] px-3 py-1.5 text-[12px] font-medium text-white/85">
                      <PillIcon size={13} className="text-rose" /> {pill}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="rounded-2xl border border-white/[0.1] bg-white/[0.06] p-4 backdrop-blur">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/50">Studio pulse</div>
              <div className="mt-4 grid gap-3.5">
                {pulse.map((bar) => (
                  <div key={bar.label}>
                    <div className="mb-1.5 flex justify-between text-[12px] font-medium">
                      <span className="text-white/75">{bar.label}</span>
                      <span className="font-semibold">{bar.value}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/12">
                      <div className="h-full rounded-full bg-gradient-to-r from-rose to-mauve" style={{ width: `${bar.value}%` }} />
                    </div>
                    {/* The figure behind the percentage — "50%" alone says nothing. */}
                    <div className="mt-1.5 text-[11px] font-medium text-white/45">{bar.detail}</div>
                  </div>
                ))}
              </div>
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
            <div className="mt-5 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-plum-softer px-4 py-8 text-center">
              <span className="grid size-11 place-items-center rounded-full bg-success-soft text-success">
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
                    className="relative overflow-hidden rounded-xl border border-line-2 bg-card p-3 pl-4 transition hover:border-plum-line hover:shadow-[var(--shadow-soft)]"
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
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} stat={stat} />
        ))}
      </section>

      {data.revenueTrend && data.revenueTrend.length > 0 ? (
        <section className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-xl bg-plum-soft text-plum"><TrendingUp size={16} /></span>
            <div>
              <h2 className="text-[15px] font-semibold">Revenue trend</h2>
              <p className="text-[12px] text-muted">Weekly takings over the last 6 weeks — hover for exact figures.</p>
            </div>
          </div>
          <TrendChart
            height={180}
            ariaLabel="Weekly revenue over the last 6 weeks"
            series={[{ name: "Revenue", color: "var(--plum)", points: data.revenueTrend }]}
          />
        </section>
      ) : null}

      {/* Schedule + client signals */}
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold">Next up today</h2>
              <p className="mt-0.5 text-[12.5px] text-muted">What&apos;s left of the day, in order — including the gaps.</p>
            </div>
            <Link href={`/${businessSlug}/calendar`} className="inline-flex items-center gap-1 rounded-xl border border-line px-3 py-2 text-[12.5px] font-semibold text-ink hover:bg-sunken">
              Calendar <ArrowUpRight size={14} />
            </Link>
          </div>
          {timeline.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-plum-softer px-4 py-10 text-center">
              <span className="grid size-11 place-items-center rounded-full bg-plum-soft text-plum">
                <CalendarCheck size={20} />
              </span>
              <div className="mt-3 text-[13.5px] font-semibold">Nothing left today</div>
              <p className="mt-1 text-[12.5px] text-muted">The rest of the day is clear.</p>
              <Link href={`/${businessSlug}/appointments`} className="mt-4 rounded-xl bg-gradient-to-r from-plum to-wine px-4 py-2 text-[12.5px] font-semibold text-white">
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
                    className="flex items-center gap-3 rounded-xl border border-dashed border-line bg-sunken/60 px-4 py-2.5"
                  >
                    <Clock size={13} className="shrink-0 text-faint" />
                    <span className="text-[12px] font-semibold text-muted">{entry.label}</span>
                    <span className="text-[11.5px] text-faint">{entry.detail}</span>
                  </li>
                ) : (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line-2 bg-card px-4 py-3 transition hover:border-plum-line"
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

        <div className="card p-5">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <Users size={17} className="text-plum" /> Client retention
          </h2>
          <p className="mt-0.5 text-[12.5px] text-muted">Who to bring back before they lapse.</p>
          {clientSignals.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-line bg-plum-softer px-4 py-8 text-center text-[12.5px] text-muted">
              No client signals to surface yet.
            </div>
          ) : (
            <div className="mt-4 grid gap-2.5">
              {clientSignals.map((client) => (
                <div key={client.name} className="rounded-2xl border border-line-2 p-3.5 hover:border-plum-line">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-[13.5px] text-ink">{client.name}</strong>
                    <span className="rounded-full bg-plum-soft px-2 py-0.5 text-[10.5px] font-semibold text-plum">{client.tag}</span>
                  </div>
                  <div className="mt-1.5 text-[12.5px] text-muted">{client.note}</div>
                  <div className="mt-1.5 text-[12px] font-semibold text-ink">{client.spend} lifetime</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Team + inventory */}
      <section className="grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <Sparkles size={17} className="text-plum" /> Staff utilization
          </h2>
          <p className="mt-0.5 text-[12.5px] text-muted">Booked hours and revenue by team member.</p>
          {staff.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-line bg-plum-softer px-4 py-8 text-center text-[12.5px] text-muted">
              No active staff members yet.
            </div>
          ) : (
            <div className="mt-4 grid gap-4">
              {staff.map((person) => (
                <div key={person.name}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-full bg-plum-soft text-[12px] font-semibold text-plum">
                        {person.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                      </span>
                      <div>
                        <div className="text-[13.5px] font-semibold text-ink">{person.name}</div>
                        <div className="text-[12px] text-muted">{person.role}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[13px] font-semibold text-ink">{person.revenue}</div>
                      <div className="text-[11.5px] text-muted">{person.bookedLabel}</div>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sunken">
                    <div className="h-full rounded-full bg-gradient-to-r from-plum to-mauve" style={{ width: `${person.bookedPercent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <Package size={17} className="text-plum" /> Inventory risk
          </h2>
          <p className="mt-0.5 text-[12.5px] text-muted">Stock health across tracked products.</p>
          {inventory.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-line bg-plum-softer px-4 py-8 text-center text-[12.5px] text-muted">
              Everything is well stocked.
            </div>
          ) : (
            <div className="mt-4 grid gap-3.5">
              {inventory.map((product) => {
                const critical = product.level < 35;
                const warn = product.level < 70;
                return (
                  <div key={product.item}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-[13px]">
                      <span className="flex items-center gap-2 font-semibold text-ink">
                        {critical ? <TriangleAlert size={14} className="text-danger" /> : null}
                        {product.item}
                      </span>
                      <span className={`font-semibold ${critical ? "text-danger" : "text-muted"}`}>{product.stock}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
                      <div
                        className={`h-full rounded-full ${critical ? "bg-danger" : warn ? "bg-warning" : "bg-success"}`}
                        style={{ width: `${Math.max(product.level, 4)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <Link href={`/${businessSlug}/inventory`} className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-semibold text-plum hover:gap-1.5">
                Manage inventory <ArrowRight size={13} />
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
