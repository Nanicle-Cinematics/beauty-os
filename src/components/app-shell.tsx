"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarClock,
  CalendarDays,
  Users,
  Sparkles,
  UserCog,
  Package,
  CreditCard,
  Wallet,
  Megaphone,
  Brain,
  BarChart3,
  Bell,
  Plus,
  Search,
  LogOut,
  ArrowUpRight,
  ChevronsUpDown,
  Settings,
  PanelLeft,
  Download,
  X,
  type LucideIcon,
} from "lucide-react";
import type { TenantChrome } from "@/lib/tenant-data";

type NavItem = { label: string; path: string; icon: LucideIcon };

const primaryNav: NavItem[] = [
  { label: "Dashboard", path: "", icon: LayoutDashboard },
  { label: "Calendar", path: "calendar", icon: CalendarDays },
  { label: "Appointments", path: "appointments", icon: CalendarClock },
  { label: "Clients", path: "clients", icon: Users },
  { label: "Services", path: "services", icon: Sparkles },
  { label: "Staff", path: "staff", icon: UserCog },
  { label: "Inventory", path: "inventory", icon: Package },
  { label: "Payments", path: "payments", icon: CreditCard },
  { label: "Finance", path: "finance", icon: Wallet },
  { label: "Marketing", path: "marketing", icon: Megaphone },
  { label: "AI Insights", path: "ai-insights", icon: Brain },
  { label: "Reports", path: "reports", icon: BarChart3 },
];

const quickAdd = [
  { label: "New booking", path: "appointments" },
  { label: "New client", path: "clients" },
  { label: "New service", path: "services" },
  { label: "Record payment", path: "payments" },
];

function sectionTitle(pathname: string, slug: string): string {
  const rest = pathname.replace(`/${slug}`, "").replace(/^\//, "");
  const seg = rest.split("/")[0] ?? "";
  const match = primaryNav.find((item) => item.path === seg);
  if (seg === "" || !match) return "Operations dashboard";
  return match.label;
}

export function AppShell({
  chrome,
  children,
}: {
  chrome: TenantChrome;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const slug = chrome.slug;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const title = sectionTitle(pathname, slug);

  const isActive = (path: string) => {
    const base = `/${slug}`;
    if (path === "") return pathname === base;
    return pathname === `${base}/${path}` || pathname.startsWith(`${base}/${path}/`);
  };

  const sidebar = (
    <div className="flex h-full flex-col gap-6 px-4 py-5">
      <div className="flex items-center justify-between">
        <Link href={`/${slug}`} className="flex items-center gap-3" onClick={() => setDrawerOpen(false)}>
          <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-plum to-wine text-base font-serif font-semibold text-white shadow-[0_6px_18px_rgba(84,33,63,0.45)]">
            B
          </span>
          <span className="leading-tight">
            <span className="block font-serif text-lg font-semibold tracking-tight text-white">Beauty OS</span>
            <span className="block text-[10.5px] font-medium uppercase tracking-[0.16em] text-white/45">
              Beauty business, smarter
            </span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          className="grid size-9 place-items-center rounded-xl text-white/60 hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="grid gap-0.5">
        {primaryNav.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={`/${slug}${item.path ? `/${item.path}` : ""}`}
              onClick={() => setDrawerOpen(false)}
              aria-current={active ? "page" : undefined}
              className={`group relative flex min-h-10 items-center gap-3 rounded-xl px-3 text-[13.5px] font-medium transition ${
                active
                  ? "bg-white/[0.09] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                  : "text-white/60 hover:bg-white/[0.05] hover:text-white/90"
              }`}
            >
              {active ? (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-gradient-to-b from-rose to-mauve" />
              ) : null}
              <Icon size={17} strokeWidth={active ? 2.1 : 1.8} className={active ? "text-rose" : "text-white/50 group-hover:text-white/80"} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto grid gap-3">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-rose">Plan</span>
            {chrome.isTrial ? (
              <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold text-gold">Trial</span>
            ) : null}
          </div>
          <div className="mt-1.5 font-serif text-[15px] font-semibold text-white">{chrome.planName}</div>
          <div className="mt-1 text-[11.5px] leading-5 text-white/45">
            {chrome.staffSeats} staff {chrome.staffSeats === 1 ? "seat" : "seats"} · {chrome.branchCount} branch · {chrome.status}
          </div>
          <Link
            href="/settings"
            className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-plum to-wine px-3 py-2 text-[12.5px] font-semibold text-white shadow-[0_6px_16px_rgba(84,33,63,0.4)]"
          >
            Upgrade plan <ArrowUpRight size={14} />
          </Link>
        </div>

        <div className="grid gap-0.5 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-2">
          <div className="truncate px-2 pb-1 pt-1 text-[11px] font-semibold text-white/45" title={chrome.account.email}>
            {chrome.account.email}
          </div>
          <Link href="/settings" className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] font-medium text-white/60 hover:bg-white/[0.06] hover:text-white">
            <Settings size={15} /> Settings
          </Link>
          {chrome.account.canSwitch ? (
            <Link href="/app" className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] font-medium text-white/60 hover:bg-white/[0.06] hover:text-white">
              <ChevronsUpDown size={15} /> Switch workspace
            </Link>
          ) : null}
          <a
            href={`/${slug}/data-export`}
            download
            className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] font-medium text-white/60 hover:bg-white/[0.06] hover:text-white"
          >
            <Download size={15} /> Export data
          </a>
          <Link href="/logout" prefetch={false} className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] font-medium text-white/60 hover:bg-white/[0.06] hover:text-white">
            <LogOut size={15} /> Sign out
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen overflow-y-auto bg-sidebar lg:block">
          {sidebar}
        </aside>

        {/* Mobile drawer */}
        {drawerOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 backdrop-blur-sm"
              style={{ background: "rgba(29,18,32,0.55)" }}
              onClick={() => setDrawerOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 w-[272px] overflow-y-auto bg-sidebar shadow-2xl animate-fade-up">
              {sidebar}
            </div>
          </div>
        ) : null}

        {/* Content column */}
        <div className="min-w-0">
          <header className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur-md sm:px-6">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-card text-muted hover:text-ink lg:hidden"
              aria-label="Open menu"
            >
              <PanelLeft size={18} />
            </button>

            <div className="min-w-0 shrink-0 pr-1 sm:border-r sm:border-line sm:pr-5">
              <div className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-plum">
                {chrome.name}
              </div>
              <h1 className="truncate text-[15px] font-semibold tracking-tight sm:text-base">{title}</h1>
            </div>

            <label className="hidden h-10 min-w-40 flex-1 items-center gap-2.5 rounded-xl border border-line bg-sunken px-3.5 text-sm text-muted focus-within:border-plum md:flex">
              <Search size={16} className="shrink-0 text-faint" />
              <input
                className="w-full bg-transparent text-ink outline-none placeholder:text-faint"
                placeholder="Search clients, bookings, products…"
              />
            </label>

            <div className="ml-auto flex items-center gap-2">
              {/* Quick add */}
              <details className="group relative">
                <summary className="flex h-10 cursor-pointer list-none items-center gap-1.5 rounded-xl border border-line bg-card px-3 text-sm font-medium text-ink hover:bg-sunken [&::-webkit-details-marker]:hidden">
                  <Plus size={16} className="text-plum" />
                  <span className="hidden sm:inline">Quick add</span>
                </summary>
                <div className="absolute right-0 z-40 mt-2 w-52 overflow-hidden rounded-2xl border border-line bg-card p-1.5 shadow-[var(--shadow-lift)]">
                  {quickAdd.map((q) => (
                    <Link
                      key={q.label}
                      href={`/${slug}/${q.path}`}
                      className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-ink hover:bg-plum-soft hover:text-plum"
                    >
                      <Plus size={14} className="text-mauve" />
                      {q.label}
                    </Link>
                  ))}
                </div>
              </details>

              {/* Notifications */}
              <details className="group relative">
                <summary className="grid size-10 cursor-pointer list-none place-items-center rounded-xl border border-line bg-card text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
                  <Bell size={17} />
                </summary>
                <div className="absolute right-0 z-40 mt-2 w-72 rounded-2xl border border-line bg-card p-5 text-center shadow-[var(--shadow-lift)]">
                  <div className="mx-auto grid size-11 place-items-center rounded-full bg-plum-soft text-plum">
                    <Bell size={18} />
                  </div>
                  <div className="mt-3 text-sm font-semibold text-ink">You&apos;re all caught up</div>
                  <p className="mt-1 text-xs text-muted">New bookings and alerts will show up here.</p>
                </div>
              </details>

              {/* Primary action */}
              <Link
                href={`/${slug}/appointments`}
                className="flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-plum to-wine px-3.5 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(84,33,63,0.28)] hover:brightness-105 sm:px-4"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">New booking</span>
                <span className="sm:hidden">Book</span>
              </Link>
            </div>
          </header>

          <main className="px-4 py-5 sm:px-6 sm:py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
