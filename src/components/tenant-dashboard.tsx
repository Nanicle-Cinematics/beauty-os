import Link from "next/link";

const navItems: { label: string; icon: string; section?: string; path?: string }[] = [
  { label: "Dashboard", icon: "⌘", section: "dashboard", path: "" },
  { label: "Appointments", icon: "◷", section: "appointments", path: "appointments" },
  { label: "Clients", icon: "◎", section: "clients", path: "clients" },
  { label: "Services", icon: "◇" },
  { label: "Staff", icon: "◱" },
  { label: "Inventory", icon: "▤" },
  { label: "Payments", icon: "₵" },
  { label: "Marketing", icon: "✦" },
];

const stats = [
  { label: "Today revenue", value: "GH₵ 4,820", detail: "+18% vs last Monday", tone: "rose" },
  { label: "Bookings today", value: "18", detail: "5 checked in · 2 deposits due", tone: "teal" },
  { label: "Client retention", value: "72%", detail: "31 repeat visits this week", tone: "blue" },
  { label: "Inventory alerts", value: "7", detail: "3 critical stock items", tone: "amber" },
];

const appointments = [
  { time: "09:00", client: "Ama Serwaa", service: "Silk press + trim", staff: "Nadia", status: "Checked in", value: "GH₵ 420" },
  { time: "10:30", client: "Esi Manu", service: "Soft glam", staff: "Mina", status: "Deposit paid", value: "GH₵ 650" },
  { time: "12:00", client: "Akua Mensah", service: "Wig install", staff: "Nadia", status: "Confirmed", value: "GH₵ 780" },
  { time: "14:15", client: "Afia Owusu", service: "Gel manicure", staff: "Louise", status: "New client", value: "GH₵ 260" },
  { time: "16:00", client: "Yaa Boateng", service: "Bridal trial", staff: "Mina", status: "VIP", value: "GH₵ 1,100" },
];

const staff = [
  { name: "Nadia", role: "Senior stylist", booked: "86%", revenue: "GH₵ 1,640", color: "bg-emerald-500" },
  { name: "Mina", role: "Makeup artist", booked: "78%", revenue: "GH₵ 1,750", color: "bg-rose-500" },
  { name: "Louise", role: "Nail tech", booked: "52%", revenue: "GH₵ 690", color: "bg-blue-500" },
  { name: "Efua", role: "Reception", booked: "Front desk", revenue: "12 tasks", color: "bg-amber-500" },
];

const clients = [
  { name: "Mabel A.", tag: "VIP", note: "Prefers warm undertones", spend: "GH₵ 8,420" },
  { name: "Nana E.", tag: "At risk", note: "No visit in 74 days", spend: "GH₵ 1,260" },
  { name: "Serwaa K.", tag: "Birthday", note: "Send facial promo", spend: "GH₵ 3,980" },
];

const inventory = [
  { item: "Lace adhesive", stock: "2 bottles", level: 22 },
  { item: "Developer 20 vol", stock: "4 units", level: 38 },
  { item: "Nude gel polish", stock: "1 unit", level: 12 },
];

const tasks = [
  "Confirm tomorrow's bridal party arrival times",
  "Approve Nana's commission payout",
  "Order lace adhesive before Friday",
  "Review no-show policy update",
];

const toneClasses: Record<string, string> = {
  rose: "border-rose-200 bg-rose-50 text-rose-700",
  teal: "border-emerald-200 bg-emerald-50 text-emerald-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
};

type TenantDashboardProps = {
  businessName: string;
  businessSlug: string;
  planName?: string;
  staffSeats?: number;
  branchCount?: number;
  automationStatus?: string;
  currentSection?: "dashboard" | "appointments" | "clients";
};

export function TenantDashboard({
  businessName,
  businessSlug,
  planName = "Studio Pro",
  staffSeats = 6,
  branchCount = 1,
  automationStatus = "automated reminders active",
  currentSection = "dashboard",
}: TenantDashboardProps) {
  return (
    <main className="min-h-screen bg-[#f6f8f6] text-[#111b17]">
      <div className="grid min-h-screen grid-cols-[248px_minmax(0,1fr)] max-[920px]:grid-cols-1">
        <aside className="sticky top-0 flex h-screen flex-col gap-5 overflow-y-auto border-r border-[#dbe4de] bg-[#10261f] px-4 py-5 text-white max-[920px]:static max-[920px]:h-auto">
          <div className="flex items-center gap-3 border-b border-white/10 pb-5">
            <div className="grid size-11 place-items-center rounded-2xl bg-[#f2c66d] text-lg font-black text-[#10261f]">
              BO
            </div>
            <div>
              <div className="text-sm font-black tracking-tight">Beauty OS</div>
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
                    ? "bg-white text-[#10261f]"
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

          <div className="mt-auto rounded-2xl border border-white/10 bg-white/7 p-4">
            <div className="text-xs font-black uppercase tracking-[0.14em] text-[#f2c66d]">
              Plan
            </div>
            <div className="mt-2 text-sm font-bold">{planName}</div>
            <div className="mt-1 text-xs leading-5 text-white/62">
              {staffSeats} staff seats · {branchCount} branch · {automationStatus}
            </div>
          </div>
        </aside>

        <section className="min-w-0 px-6 py-5 max-[720px]:px-3">
          <header className="sticky top-3 z-20 mb-5 flex min-h-16 items-center gap-3 rounded-3xl border border-[#dbe4de] bg-white/88 px-4 shadow-[0_18px_45px_rgba(16,38,31,0.08)] backdrop-blur max-[720px]:static max-[720px]:flex-wrap">
            <div className="min-w-0 border-r border-[#dbe4de] pr-5 max-[720px]:border-r-0">
              <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#1d7b5d]">
                {businessName}
              </div>
              <h1 className="text-xl font-black tracking-tight">Operations dashboard</h1>
            </div>
            <label className="flex h-11 min-w-56 flex-1 items-center gap-3 rounded-2xl border border-[#dbe4de] bg-[#f8faf8] px-4 text-sm text-[#6b7c73] max-[720px]:order-3 max-[720px]:min-w-full">
              <span>⌕</span>
              <input
                className="w-full bg-transparent outline-none"
                placeholder="Search clients, bookings, products..."
              />
            </label>
            <button className="grid size-11 place-items-center rounded-2xl border border-[#dbe4de] bg-white text-[#1d7b5d]">
              ◐
            </button>
            <button className="rounded-2xl bg-[#10261f] px-4 py-3 text-sm font-black text-white">
              New booking
            </button>
          </header>

          <div className="grid gap-5">
            <section className="grid grid-cols-[minmax(0,1.25fr)_360px] gap-5 max-[1180px]:grid-cols-1">
              <div className="overflow-hidden rounded-[28px] bg-[#10261f] text-white shadow-[0_24px_60px_rgba(16,38,31,0.18)]">
                <div className="grid min-h-[235px] grid-cols-[minmax(0,1fr)_230px] gap-6 bg-[radial-gradient(circle_at_85%_12%,rgba(242,198,109,0.26),transparent_15rem),linear-gradient(125deg,#10261f,#1d5f4b)] p-7 max-[720px]:grid-cols-1">
                  <div className="flex flex-col justify-between gap-8">
                    <div>
                      <div className="mb-4 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#f2c66d]">
                        Today · Monday, 13 July
                      </div>
                      <h2 className="max-w-2xl text-4xl font-black leading-tight tracking-tight max-[720px]:text-3xl">
                        Keep the studio full, calm, and profitable.
                      </h2>
                      <p className="mt-4 max-w-xl text-sm leading-6 text-white/72">
                        Your appointment flow, client care, stock risk, and daily money picture in one place.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-bold">
                      <span className="rounded-full bg-white/12 px-3 py-2">Next gap: 13:30</span>
                      <span className="rounded-full bg-white/12 px-3 py-2">3 unpaid deposits</span>
                      <span className="rounded-full bg-white/12 px-3 py-2">2 birthdays today</span>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-white/12 bg-white/10 p-4 backdrop-blur">
                    <div className="text-xs font-black uppercase tracking-[0.14em] text-white/55">
                      Studio pulse
                    </div>
                    <div className="mt-5 grid gap-4">
                      {["Bookings", "Capacity", "Checkout"].map((label, index) => (
                        <div key={label}>
                          <div className="mb-2 flex justify-between text-xs font-bold">
                            <span>{label}</span>
                            <span>{[82, 74, 61][index]}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-white/15">
                            <div
                              className="h-full rounded-full bg-[#f2c66d]"
                              style={{ width: `${[82, 74, 61][index]}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-[#dbe4de] bg-white p-5 shadow-[0_12px_35px_rgba(16,38,31,0.06)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-black">Front desk queue</h2>
                    <p className="mt-1 text-sm text-[#6b7c73]">Tasks that need a decision.</p>
                  </div>
                  <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-black text-rose-700">
                    {tasks.length} open
                  </span>
                </div>
                <div className="mt-5 grid gap-3">
                  {tasks.map((task) => (
                    <label key={task} className="flex items-start gap-3 rounded-2xl border border-[#e4ebe6] p-3 text-sm font-semibold">
                      <input type="checkbox" className="mt-1 accent-[#1d7b5d]" />
                      <span>{task}</span>
                    </label>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid grid-cols-4 gap-4 max-[1180px]:grid-cols-2 max-[640px]:grid-cols-1">
              {stats.map((stat) => (
                <article key={stat.label} className="rounded-3xl border border-[#dbe4de] bg-white p-5 shadow-[0_12px_35px_rgba(16,38,31,0.05)]">
                  <div className={`mb-5 inline-flex rounded-full border px-3 py-1 text-xs font-black ${toneClasses[stat.tone]}`}>
                    {stat.label}
                  </div>
                  <div className="text-3xl font-black tracking-tight">{stat.value}</div>
                  <div className="mt-2 text-sm font-semibold text-[#6b7c73]">{stat.detail}</div>
                </article>
              ))}
            </section>

            <section className="grid grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)] gap-5 max-[1180px]:grid-cols-1">
              <div className="rounded-[24px] border border-[#dbe4de] bg-white p-5 shadow-[0_12px_35px_rgba(16,38,31,0.06)]">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black">Today&apos;s appointments</h2>
                    <p className="mt-1 text-sm text-[#6b7c73]">Live schedule, status, staff and expected value.</p>
                  </div>
                  <Link href={`/${businessSlug}/appointments`} className="rounded-2xl border border-[#dbe4de] px-4 py-2 text-sm font-black">Calendar</Link>
                </div>
                <div className="overflow-hidden rounded-2xl border border-[#dbe4de]">
                  <div className="grid grid-cols-[88px_1.2fr_1fr_110px_120px] bg-[#f2f7f4] px-4 py-3 text-[11px] font-black uppercase tracking-[0.12em] text-[#65766d] max-[760px]:hidden">
                    <span>Time</span><span>Client</span><span>Staff</span><span>Status</span><span>Value</span>
                  </div>
                  {appointments.map((appt) => (
                    <div key={`${appt.time}-${appt.client}`} className="grid grid-cols-[88px_1.2fr_1fr_110px_120px] items-center gap-3 border-t border-[#e6eee9] px-4 py-4 text-sm max-[760px]:grid-cols-1">
                      <div className="font-black text-[#1d7b5d]">{appt.time}</div>
                      <div>
                        <div className="font-black">{appt.client}</div>
                        <div className="mt-1 text-xs font-semibold text-[#6b7c73]">{appt.service}</div>
                      </div>
                      <div className="font-bold">{appt.staff}</div>
                      <div>
                        <span className="rounded-full bg-[#eff7f2] px-3 py-1 text-xs font-black text-[#1d7b5d]">
                          {appt.status}
                        </span>
                      </div>
                      <div className="font-black">{appt.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-5">
                <div className="rounded-[24px] border border-[#dbe4de] bg-white p-5 shadow-[0_12px_35px_rgba(16,38,31,0.06)]">
                  <h2 className="text-lg font-black">Client signals</h2>
                  <div className="mt-4 grid gap-3">
                    {clients.map((client) => (
                      <div key={client.name} className="rounded-2xl border border-[#e6eee9] p-3">
                        <div className="flex items-center justify-between gap-2">
                          <strong>{client.name}</strong>
                          <span className="rounded-full bg-[#f6edf0] px-2 py-1 text-[11px] font-black text-rose-700">
                            {client.tag}
                          </span>
                        </div>
                        <div className="mt-2 text-sm text-[#6b7c73]">{client.note}</div>
                        <div className="mt-2 text-xs font-black text-[#10261f]">{client.spend} lifetime</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5 max-[980px]:grid-cols-1">
              <div className="rounded-[24px] border border-[#dbe4de] bg-white p-5 shadow-[0_12px_35px_rgba(16,38,31,0.06)]">
                <h2 className="text-lg font-black">Staff utilization</h2>
                <div className="mt-5 grid gap-4">
                  {staff.map((person) => (
                    <div key={person.name} className="grid grid-cols-[1fr_86px] items-center gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-black">{person.name}</div>
                            <div className="text-xs font-semibold text-[#6b7c73]">{person.role}</div>
                          </div>
                          <div className="text-right text-xs font-black">{person.revenue}</div>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-[#e8f0eb]">
                          <div className={`h-full rounded-full ${person.color}`} style={{ width: person.booked }} />
                        </div>
                      </div>
                      <div className="text-right text-sm font-black">{person.booked}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-[#dbe4de] bg-white p-5 shadow-[0_12px_35px_rgba(16,38,31,0.06)]">
                <h2 className="text-lg font-black">Inventory watchlist</h2>
                <div className="mt-5 grid gap-4">
                  {inventory.map((product) => (
                    <div key={product.item}>
                      <div className="mb-2 flex justify-between gap-3 text-sm">
                        <strong>{product.item}</strong>
                        <span className="font-bold text-[#6b7c73]">{product.stock}</span>
                      </div>
                      <div className="h-3 rounded-full bg-[#e8f0eb]">
                        <div
                          className={`h-full rounded-full ${product.level < 25 ? "bg-rose-500" : "bg-amber-500"}`}
                          style={{ width: `${product.level}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
