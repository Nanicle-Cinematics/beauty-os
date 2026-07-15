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
  Brain,
  Cake,
  Coins,
} from "lucide-react";
import type { TenantDashboardData, DashStat } from "@/lib/dashboard-data";

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

type Insight = { icon: typeof Brain; kind: string; title: string; body: string; href?: string; cta?: string };

// Contextual intelligence derived entirely from the real data props — no fabricated numbers.
function buildInsights(data: TenantDashboardData, slug: string): Insight[] {
  const insights: Insight[] = [];
  const capacity = data.pulse.find((p) => p.label.toLowerCase().includes("capacity"));
  const atRisk = data.inventory.filter((i) => i.level < 35);

  if (atRisk.length > 0) {
    const names = atRisk.slice(0, 2).map((i) => i.item).join(" and ");
    insights.push({
      icon: Package,
      kind: "Inventory risk",
      title: `${names} running low`,
      body: `${atRisk.length} product${atRisk.length > 1 ? "s are" : " is"} below its reorder point and may affect upcoming appointments.`,
      href: `/${slug}/inventory`,
      cta: "View inventory",
    });
  }
  if (capacity) {
    insights.push({
      icon: capacity.value >= 75 ? TriangleAlert : Sparkles,
      kind: "Capacity",
      title:
        capacity.value >= 75
          ? `You're at ${capacity.value}% capacity today`
          : `${capacity.value}% of today's capacity is booked`,
      body:
        capacity.value >= 75
          ? "The book is filling fast — protect buffer time for walk-ins and checkout."
          : "Room to fill more chairs — a same-day promo could lift today's revenue.",
      href: `/${slug}/appointments`,
      cta: "Open schedule",
    });
  }
  if (data.clientSignals.length > 0) {
    insights.push({
      icon: Users,
      kind: "Retention",
      title: `${data.clientSignals.length} client${data.clientSignals.length > 1 ? "s" : ""} need attention`,
      body: "Clients flagged for follow-up, unpaid balances, or lapsed visits — a nudge keeps them coming back.",
      href: `/${slug}/clients`,
      cta: "View clients",
    });
  }
  if (insights.length < 3 && data.tasks.length > 0) {
    insights.push({
      icon: ListChecks,
      kind: "Front desk",
      title: `${data.tasks.length} task${data.tasks.length > 1 ? "s" : ""} need a decision`,
      body: "Confirmations, deposits, and reorders are waiting in your front-desk queue.",
    });
  }
  return insights.slice(0, 3);
}

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
  const { tenant, stats, pulse, pills, tasks, appointments, clientSignals, staff, inventory } = data;
  const ownerName = tenant.name;
  const insights = buildInsights(data, businessSlug);

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
                  Keep the studio full, calm, and profitable.
                </h2>
                <p className="mt-3 max-w-md text-[13.5px] leading-6 text-white/65">
                  Your bookings, client care, stock risk, and daily money — one command view for {ownerName}.
                </p>
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
            {tasks.length > 0 ? (
              <span className="rounded-full bg-warning-soft px-2.5 py-1 text-[11px] font-semibold text-warning">
                {tasks.length} open
              </span>
            ) : null}
          </div>
          {tasks.length === 0 ? (
            <div className="mt-5 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-plum-softer px-4 py-8 text-center">
              <span className="grid size-11 place-items-center rounded-full bg-success-soft text-success">
                <CheckCircle2 size={20} />
              </span>
              <div className="mt-3 text-[13.5px] font-semibold text-ink">All clear</div>
              <p className="mt-1 text-[12.5px] text-muted">No actions need your attention right now.</p>
            </div>
          ) : (
            <div className="mt-4 grid gap-2.5">
              {tasks.map((task) => (
                <label key={task} className="flex items-start gap-3 rounded-xl border border-line-2 bg-card p-3 text-[13px] font-medium hover:border-plum-line">
                  <input type="checkbox" className="mt-0.5 size-4 accent-[var(--plum)]" />
                  <span>{task}</span>
                </label>
              ))}
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

      {/* Smart insights */}
      {insights.length > 0 ? (
        <section className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-xl bg-plum-soft text-plum">
              <Brain size={16} />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold">Smart insights</h2>
              <p className="text-[12px] text-muted">What your operation is telling you right now.</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {insights.map((insight) => {
              const Icon = insight.icon;
              return (
                <div key={insight.title} className="flex flex-col rounded-2xl border border-line bg-gradient-to-b from-plum-softer to-card p-4">
                  <div className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-plum shadow-[var(--shadow-soft)]">
                    <Icon size={12} /> {insight.kind}
                  </div>
                  <div className="text-[13.5px] font-semibold text-ink">{insight.title}</div>
                  <p className="mt-1 flex-1 text-[12.5px] leading-5 text-muted">{insight.body}</p>
                  {insight.href ? (
                    <Link href={insight.href} className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-plum hover:gap-1.5">
                      {insight.cta} <ArrowRight size={13} />
                    </Link>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Schedule + client signals */}
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold">Today&apos;s schedule</h2>
              <p className="mt-0.5 text-[12.5px] text-muted">Live bookings, status, staff and expected value.</p>
            </div>
            <Link href={`/${businessSlug}/appointments`} className="inline-flex items-center gap-1 rounded-xl border border-line px-3 py-2 text-[12.5px] font-semibold text-ink hover:bg-sunken">
              Calendar <ArrowUpRight size={14} />
            </Link>
          </div>
          {appointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-plum-softer px-4 py-10 text-center">
              <span className="grid size-11 place-items-center rounded-full bg-plum-soft text-plum">
                <CalendarCheck size={20} />
              </span>
              <div className="mt-3 text-[13.5px] font-semibold">Your schedule is clear</div>
              <p className="mt-1 text-[12.5px] text-muted">No appointments booked for today yet.</p>
              <Link href={`/${businessSlug}/appointments`} className="mt-4 rounded-xl bg-gradient-to-r from-plum to-wine px-4 py-2 text-[12.5px] font-semibold text-white">
                Create booking
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line">
              <div className="grid grid-cols-[80px_1.3fr_1fr_120px_110px] bg-sunken px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted max-[760px]:hidden">
                <span>Time</span><span>Client</span><span>Staff</span><span>Status</span><span>Value</span>
              </div>
              {appointments.map((appt) => (
                <div key={appt.id} className="grid grid-cols-[80px_1.3fr_1fr_120px_110px] items-center gap-3 border-t border-line-2 px-4 py-3.5 text-[13px] max-[760px]:grid-cols-2">
                  <div className="font-semibold text-plum">{appt.time}</div>
                  <div>
                    <div className="font-semibold text-ink">{appt.client}</div>
                    <div className="mt-0.5 text-[12px] text-muted">{appt.service}</div>
                  </div>
                  <div className="font-medium text-ink">{appt.staff}</div>
                  <div>
                    <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusTone(appt.status)}`}>
                      {appt.status}
                    </span>
                  </div>
                  <div className="font-semibold text-ink">{appt.value}</div>
                </div>
              ))}
            </div>
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
