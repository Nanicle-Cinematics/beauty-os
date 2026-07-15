import Link from "next/link";
import type { TenantDashboardData } from "@/lib/dashboard-data";

const navItems: { label: string; icon: string; section?: string; path?: string }[] = [
  { label: "Dashboard", icon: "⌘", section: "dashboard", path: "" },
  { label: "Appointments", icon: "◷", section: "appointments", path: "appointments" },
  { label: "Clients", icon: "◎", section: "clients", path: "clients" },
  { label: "Services", icon: "◇", section: "services", path: "services" },
  { label: "Staff", icon: "◱", section: "staff", path: "staff" },
  { label: "Inventory", icon: "▤", section: "inventory", path: "inventory" },
  { label: "Payments", icon: "₵", section: "payments", path: "payments" },
  { label: "Marketing", icon: "✦", section: "marketing", path: "marketing" },
];

const toneClasses: Record<string, string> = {
  rose: "border-rose-200 bg-rose-50 text-rose-700",
  teal: "border-emerald-200 bg-emerald-50 text-emerald-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
};

type TenantDashboardProps = {
  data: TenantDashboardData;
  businessSlug: string;
  account?: { email: string; canSwitch: boolean };
  currentSection?:
    | "dashboard"
    | "appointments"
    | "clients"
    | "services"
    | "staff"
    | "inventory"
    | "payments"
    | "marketing";
};

export function TenantDashboard({ data, businessSlug, account, currentSection = "dashboard" }: TenantDashboardProps) {
  const { tenant, stats, pulse, pills, tasks, appointments, clientSignals, staff, inventory } = data;

  return (
    <main className="min-h-screen bg-[#fafafa] text-[#18181b]">
      <div className="grid min-h-screen grid-cols-[248px_minmax(0,1fr)] max-[920px]:grid-cols-1">
        <aside className="sticky top-0 flex h-screen flex-col gap-5 overflow-y-auto border-r border-[#e7e7ea] bg-[#18181b] px-4 py-5 text-white max-[920px]:static max-[920px]:h-auto">
          <div className="flex items-center gap-3 border-b border-white/10 pb-5">
            <div className="grid size-11 place-items-center rounded-2xl bg-[#9d4e7a] text-lg font-semibold text-white">
              BO
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">Beauty OS</div>
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/50">
                Salon command
              </div>
            </div>
          </div>

          <nav className="grid gap-1">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.path !== undefined ? `/${businessSlug}${item.path ? `/${item.path}` : ""}` : `/${businessSlug}`}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold transition ${
                  item.section === currentSection
                    ? "bg-white text-[#18181b]"
                    : "text-white/72 hover:bg-white/8 hover:text-white"
                }`}
              >
                <span className="grid size-7 place-items-center rounded-lg bg-current/10 text-sm">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-auto grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/7 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9d4e7a]">
                Plan
              </div>
              <div className="mt-2 text-sm font-bold">{tenant.planName}</div>
              <div className="mt-1 text-xs leading-5 text-white/62">
                {tenant.staffSeats} staff seats · {tenant.branchCount} branch · {tenant.automationStatus}
              </div>
            </div>

            <div className="grid gap-1.5 rounded-2xl border border-white/10 bg-white/7 p-3">
              {account ? (
                <div className="truncate px-1 pb-1 text-[11px] font-bold text-white/55" title={account.email}>
                  {account.email}
                </div>
              ) : null}
              <Link href="/settings" className="rounded-xl px-3 py-2 text-sm font-bold text-white/72 transition hover:bg-white/8 hover:text-white">
                Settings
              </Link>
              {account?.canSwitch ? (
                <Link href="/app" className="rounded-xl px-3 py-2 text-sm font-bold text-white/72 transition hover:bg-white/8 hover:text-white">
                  Switch workspace
                </Link>
              ) : null}
              <Link href="/logout" className="rounded-xl px-3 py-2 text-sm font-bold text-white/72 transition hover:bg-white/8 hover:text-white">
                Sign out
              </Link>
            </div>
          </div>
        </aside>

        <section className="min-w-0 px-6 py-5 max-[720px]:px-3">
          <header className="sticky top-3 z-20 mb-5 flex min-h-16 items-center gap-3 rounded-3xl border border-[#e7e7ea] bg-white/88 px-4 shadow-[0_18px_45px_rgba(24,24,27,0.08)] backdrop-blur max-[720px]:static max-[720px]:flex-wrap">
            <div className="min-w-0 border-r border-[#e7e7ea] pr-5 max-[720px]:border-r-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9d4e7a]">
                {tenant.name}
              </div>
              <h1 className="text-xl font-semibold tracking-tight">Operations dashboard</h1>
            </div>
            <label className="flex h-11 min-w-56 flex-1 items-center gap-3 rounded-2xl border border-[#e7e7ea] bg-[#f7f7f8] px-4 text-sm text-[#71717a] max-[720px]:order-3 max-[720px]:min-w-full">
              <span>⌕</span>
              <input
                className="w-full bg-transparent outline-none"
                placeholder="Search clients, bookings, products..."
              />
            </label>
            <Link href={`/${businessSlug}/appointments`} className="grid h-11 place-items-center rounded-2xl border border-[#e7e7ea] bg-white px-3 text-[#9d4e7a]">
              ◐
            </Link>
            <Link href={`/${businessSlug}/appointments`} className="rounded-2xl bg-[#18181b] px-4 py-3 text-sm font-semibold text-white">
              New booking
            </Link>
          </header>

          <div className="grid gap-5">
            <section className="grid grid-cols-[minmax(0,1.25fr)_360px] gap-5 max-[1180px]:grid-cols-1">
              <div className="overflow-hidden rounded-[28px] bg-[#18181b] text-white shadow-[0_24px_60px_rgba(24,24,27,0.18)]">
                <div className="grid min-h-[235px] grid-cols-[minmax(0,1fr)_230px] gap-6 bg-[radial-gradient(circle_at_85%_12%,rgba(157,78,122,0.26),transparent_15rem),linear-gradient(125deg,#18181b,#3f3f46)] p-7 max-[720px]:grid-cols-1">
                  <div className="flex flex-col justify-between gap-8">
                    <div>
                      <div className="mb-4 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9d4e7a]">
                        {data.todayLabel}
                      </div>
                      <h2 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight max-[720px]:text-3xl">
                        Keep the studio full, calm, and profitable.
                      </h2>
                      <p className="mt-4 max-w-xl text-sm leading-6 text-white/72">
                        Your appointment flow, client care, stock risk, and daily money picture in one place.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-bold">
                      {pills.map((pill) => (
                        <span key={pill} className="rounded-full bg-white/12 px-3 py-2">{pill}</span>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-3xl border border-white/12 bg-white/10 p-4 backdrop-blur">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
                      Studio pulse
                    </div>
                    <div className="mt-5 grid gap-4">
                      {pulse.map((bar) => (
                        <div key={bar.label}>
                          <div className="mb-2 flex justify-between text-xs font-bold">
                            <span>{bar.label}</span>
                            <span>{bar.value}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-white/15">
                            <div
                              className="h-full rounded-full bg-[#9d4e7a]"
                              style={{ width: `${bar.value}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-[#e7e7ea] bg-white p-5 shadow-[0_12px_35px_rgba(24,24,27,0.06)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">Front desk queue</h2>
                    <p className="mt-1 text-sm text-[#71717a]">Tasks that need a decision.</p>
                  </div>
                  <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                    {tasks.length} open
                  </span>
                </div>
                <div className="mt-5 grid gap-3">
                  {tasks.map((task) => (
                    <label key={task} className="flex items-start gap-3 rounded-2xl border border-[#efeff2] p-3 text-sm font-semibold">
                      <input type="checkbox" className="mt-1 accent-[#9d4e7a]" />
                      <span>{task}</span>
                    </label>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid grid-cols-4 gap-4 max-[1180px]:grid-cols-2 max-[640px]:grid-cols-1">
              {stats.map((stat) => (
                <article key={stat.label} className="rounded-3xl border border-[#e7e7ea] bg-white p-5 shadow-[0_12px_35px_rgba(24,24,27,0.05)]">
                  <div className={`mb-5 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses[stat.tone]}`}>
                    {stat.label}
                  </div>
                  <div className="text-3xl font-semibold tracking-tight">{stat.value}</div>
                  <div className="mt-2 text-sm font-semibold text-[#71717a]">{stat.detail}</div>
                </article>
              ))}
            </section>

            <section className="grid grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)] gap-5 max-[1180px]:grid-cols-1">
              <div className="rounded-[24px] border border-[#e7e7ea] bg-white p-5 shadow-[0_12px_35px_rgba(24,24,27,0.06)]">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">Today&apos;s appointments</h2>
                    <p className="mt-1 text-sm text-[#71717a]">Live schedule, status, staff and expected value.</p>
                  </div>
                  <Link href={`/${businessSlug}/appointments`} className="rounded-2xl border border-[#e7e7ea] px-4 py-2 text-sm font-semibold">Calendar</Link>
                </div>
                {appointments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#e2e0f7] bg-[#f7f7f8] px-4 py-10 text-center text-sm font-semibold text-[#71717a]">
                    No appointments booked for today yet.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-[#e7e7ea]">
                    <div className="grid grid-cols-[88px_1.2fr_1fr_110px_120px] bg-[#f4f4f6] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#71717a] max-[760px]:hidden">
                      <span>Time</span><span>Client</span><span>Staff</span><span>Status</span><span>Value</span>
                    </div>
                    {appointments.map((appt) => (
                      <div key={appt.id} className="grid grid-cols-[88px_1.2fr_1fr_110px_120px] items-center gap-3 border-t border-[#efeff2] px-4 py-4 text-sm max-[760px]:grid-cols-1">
                        <div className="font-semibold text-[#9d4e7a]">{appt.time}</div>
                        <div>
                          <div className="font-semibold">{appt.client}</div>
                          <div className="mt-1 text-xs font-semibold text-[#71717a]">{appt.service}</div>
                        </div>
                        <div className="font-bold">{appt.staff}</div>
                        <div>
                          <span className="rounded-full bg-[#faf1f6] px-3 py-1 text-xs font-semibold text-[#9d4e7a]">
                            {appt.status}
                          </span>
                        </div>
                        <div className="font-semibold">{appt.value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-5">
                <div className="rounded-[24px] border border-[#e7e7ea] bg-white p-5 shadow-[0_12px_35px_rgba(24,24,27,0.06)]">
                  <h2 className="text-lg font-semibold">Client signals</h2>
                  {clientSignals.length === 0 ? (
                    <p className="mt-4 text-sm text-[#71717a]">No client activity to surface yet.</p>
                  ) : (
                    <div className="mt-4 grid gap-3">
                      {clientSignals.map((client) => (
                        <div key={client.name} className="rounded-2xl border border-[#efeff2] p-3">
                          <div className="flex items-center justify-between gap-2">
                            <strong>{client.name}</strong>
                            <span className="rounded-full bg-[#f6edf0] px-2 py-1 text-[11px] font-semibold text-rose-700">
                              {client.tag}
                            </span>
                          </div>
                          <div className="mt-2 text-sm text-[#71717a]">{client.note}</div>
                          <div className="mt-2 text-xs font-semibold text-[#18181b]">{client.spend} lifetime</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5 max-[980px]:grid-cols-1">
              <div className="rounded-[24px] border border-[#e7e7ea] bg-white p-5 shadow-[0_12px_35px_rgba(24,24,27,0.06)]">
                <h2 className="text-lg font-semibold">Staff utilization</h2>
                {staff.length === 0 ? (
                  <p className="mt-4 text-sm text-[#71717a]">No active staff members yet.</p>
                ) : (
                  <div className="mt-5 grid gap-4">
                    {staff.map((person) => (
                      <div key={person.name} className="grid grid-cols-[1fr_86px] items-center gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="font-semibold">{person.name}</div>
                              <div className="text-xs font-semibold text-[#71717a]">{person.role}</div>
                            </div>
                            <div className="text-right text-xs font-semibold">{person.revenue}</div>
                          </div>
                          <div className="mt-2 h-2 rounded-full bg-[#f2f2f4]">
                            <div className={`h-full rounded-full ${person.color}`} style={{ width: `${person.bookedPercent}%` }} />
                          </div>
                        </div>
                        <div className="text-right text-sm font-semibold">{person.bookedLabel}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-[24px] border border-[#e7e7ea] bg-white p-5 shadow-[0_12px_35px_rgba(24,24,27,0.06)]">
                <h2 className="text-lg font-semibold">Inventory watchlist</h2>
                {inventory.length === 0 ? (
                  <p className="mt-4 text-sm text-[#71717a]">No products tracked yet.</p>
                ) : (
                  <div className="mt-5 grid gap-4">
                    {inventory.map((product) => (
                      <div key={product.item}>
                        <div className="mb-2 flex justify-between gap-3 text-sm">
                          <strong>{product.item}</strong>
                          <span className="font-bold text-[#71717a]">{product.stock}</span>
                        </div>
                        <div className="h-3 rounded-full bg-[#f2f2f4]">
                          <div
                            className={`h-full rounded-full ${product.level < 35 ? "bg-rose-500" : product.level < 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                            style={{ width: `${product.level}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
