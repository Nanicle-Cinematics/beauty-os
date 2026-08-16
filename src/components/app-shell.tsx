"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarClock,
  Hourglass,
  CalendarDays,
  Users,
  Sparkles,
  UserCog,
  Package,
  CreditCard,
  FileText,
  Images,
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
  Store,
  PanelLeft,
  Download,
  X,
  type LucideIcon,
} from "lucide-react";
import type { TenantChrome } from "@/lib/tenant-data";
import { industryCopy } from "@/lib/industry";
import { ThemeModeButton } from "@/components/theme-mode-button";

type NavItem = { label: string; path: string; icon: LucideIcon };

const primaryNav: NavItem[] = [
  { label: "Dashboard", path: "", icon: LayoutDashboard },
  { label: "Calendar", path: "calendar", icon: CalendarDays },
  { label: "Appointments", path: "appointments", icon: CalendarClock },
  { label: "Waitlist", path: "waitlist", icon: Hourglass },
  { label: "Clients", path: "clients", icon: Users },
  { label: "Services", path: "services", icon: Sparkles },
  { label: "Staff", path: "staff", icon: UserCog },
  { label: "Inventory", path: "inventory", icon: Package },
  { label: "Payments", path: "payments", icon: CreditCard },
  { label: "Invoices", path: "invoices", icon: FileText },
  { label: "Galleries", path: "galleries", icon: Images },
  { label: "Finance", path: "finance", icon: Wallet },
  { label: "Marketing", path: "marketing", icon: Megaphone },
  { label: "AI Insights", path: "ai-insights", icon: Brain },
  { label: "Reports", path: "reports", icon: BarChart3 },
];

function quickAddFor(copy: ReturnType<typeof industryCopy>) {
  return [
    { label: "New booking", path: "appointments?new=1#new-booking" },
    { label: "New client", path: "clients?new=1#add-client" },
    { label: "New service", path: "services?new=1#add-service" },
    { label: "Record payment", path: "payments?new=1#record-payment" },
    { label: "New invoice", path: "invoices/new" },
    { label: "New gallery", path: "galleries?new=1#create-gallery" },
  ].map((item) => {
    if (item.path.startsWith("appointments")) return { ...item, label: copy.quickAdd.booking };
    if (item.path.startsWith("services")) return { ...item, label: copy.quickAdd.service };
    return item;
  });
}

function navLabel(label: string, copy: ReturnType<typeof industryCopy>) {
  if (label === "Appointments") return copy.nav.appointments;
  if (label === "Services") return copy.nav.services;
  if (label === "Staff") return copy.nav.staff;
  if (label === "Inventory") return copy.nav.inventory;
  return label;
}

function initials(name: string, email: string) {
  const source = name.trim() || email;
  return source
    .split(/\s+|@/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function workspaceInitials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function sectionTitle(pathname: string, slug: string, copy: ReturnType<typeof industryCopy>): string {
  const rest = pathname.replace(`/${slug}`, "").replace(/^\//, "");
  const seg = rest.split("/")[0] ?? "";
  if (seg === "settings") return "Business settings";
  const match = primaryNav.find((item) => item.path === seg);
  if (seg === "" || !match) return "Operations dashboard";
  return navLabel(match.label, copy);
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
  const copy = industryCopy(chrome.categoryKey);
  const quickAdd = quickAddFor(copy);
  const title = sectionTitle(pathname, slug, copy);

  const isActive = (path: string) => {
    const base = `/${slug}`;
    if (path === "") return pathname === base;
    return pathname === `${base}/${path}` || pathname.startsWith(`${base}/${path}/`);
  };

  const sidebar = (
    <div className="flex h-full flex-col gap-6 px-4 py-5">
      <div className="flex items-center justify-between border-b border-white/55 pb-5">
        <Link href={`/${slug}`} className="flex items-center gap-3" onClick={() => setDrawerOpen(false)}>
          <span className="flex min-w-0 items-center gap-2">
            {chrome.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={chrome.logoUrl} alt="" className="size-8 shrink-0 rounded-2xl object-cover shadow-[var(--shadow-soft)]" />
            ) : (
              <span className="grid size-8 shrink-0 place-items-center rounded-2xl bg-white/45 text-[10px] font-bold text-plum">
                {workspaceInitials(chrome.name)}
              </span>
            )}
            <span className="min-w-0 leading-tight">
              <span className="block max-w-[112px] truncate font-serif text-xl font-semibold tracking-tight text-ink" title={chrome.name}>
                {chrome.name}
              </span>
              <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                {copy.workspaceDescriptor}
              </span>
            </span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          className="grid size-9 place-items-center rounded-2xl text-muted hover:bg-white/55 hover:text-plum lg:hidden"
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
              className={`group relative flex min-h-11 items-center gap-3 rounded-2xl px-3 text-[13.5px] font-medium transition ${
                active
                  ? "glass-strong text-plum"
                  : "text-muted hover:bg-white/50 hover:text-ink"
              }`}
            >
              {active ? (
                <span className="absolute left-1 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-gradient-to-b from-rose via-mauve to-aqua" />
              ) : null}
              <Icon size={17} strokeWidth={active ? 2.1 : 1.8} className={active ? "text-plum" : "text-faint group-hover:text-muted"} />
              {navLabel(item.label, copy)}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto grid gap-3">
        <div className="glass-panel rounded-[24px] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-plum">Plan</span>
            {chrome.isTrial ? (
              <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold text-gold">Trial</span>
            ) : null}
          </div>
          <div className="mt-1.5 font-serif text-[15px] font-semibold text-ink">{chrome.planName}</div>
          <div className="mt-1 text-[11.5px] leading-5 text-muted">
            {chrome.staffSeats} staff {chrome.staffSeats === 1 ? "seat" : "seats"} · {chrome.branchCount} branch · {chrome.status}
          </div>
          <Link
            href={`/${slug}/settings#subscription`}
            className="primary-action mt-3 flex items-center justify-center gap-1.5 rounded-2xl px-3 py-2.5 text-[12.5px] font-semibold text-white"
          >
            Upgrade plan <ArrowUpRight size={14} />
          </Link>
        </div>

        <div className="glass-panel grid gap-0.5 rounded-[24px] p-2">
          <div className="mb-1 flex items-center gap-2 rounded-[18px] bg-white/35 p-2">
            {chrome.account.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={chrome.account.avatarUrl}
                alt=""
                className="size-9 shrink-0 rounded-2xl object-cover"
              />
            ) : (
              <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-plum-soft text-[12px] font-bold text-plum">
                {initials(chrome.account.name, chrome.account.email)}
              </span>
            )}
            <div className="min-w-0">
              <div className="truncate text-[12.5px] font-semibold text-ink">{chrome.account.name}</div>
              <div className="truncate text-[10.5px] font-semibold text-muted" title={chrome.account.email}>
                {chrome.account.email}
              </div>
            </div>
          </div>
          <Link href={`/${chrome.slug}/settings`} className="flex items-center gap-2.5 rounded-2xl px-2 py-2 text-[13px] font-medium text-muted hover:bg-white/55 hover:text-plum">
            <Store size={15} /> Business settings
          </Link>
          <Link href="/settings" className="flex items-center gap-2.5 rounded-2xl px-2 py-2 text-[13px] font-medium text-muted hover:bg-white/55 hover:text-plum">
            <Settings size={15} /> Account
          </Link>
          {chrome.account.canSwitch ? (
            <Link href="/app" className="flex items-center gap-2.5 rounded-2xl px-2 py-2 text-[13px] font-medium text-muted hover:bg-white/55 hover:text-plum">
              <ChevronsUpDown size={15} /> Switch workspace
            </Link>
          ) : null}
          <a
            href={`/${slug}/data-export`}
            download
            className="flex items-center gap-2.5 rounded-2xl px-2 py-2 text-[13px] font-medium text-muted hover:bg-white/55 hover:text-plum"
          >
            <Download size={15} /> Export data
          </a>
          <Link href="/logout" prefetch={false} className="flex items-center gap-2.5 rounded-2xl px-2 py-2 text-[13px] font-medium text-muted hover:bg-white/55 hover:text-plum">
            <LogOut size={15} /> Sign out
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <div data-theme={chrome.account.themePreference} className="min-h-screen text-ink">
      {/* Keyboard users can jump straight past the nav to the page content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-xl focus:bg-plum focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      <div className="lg:grid lg:grid-cols-[276px_minmax(0,1fr)]">
        {/* Desktop sidebar */}
        <aside className="glass-panel sticky top-0 hidden h-screen overflow-y-auto rounded-none border-y-0 border-l-0 lg:block">
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
            <div className="glass-strong animate-fade-up absolute inset-y-0 left-0 w-[284px] overflow-y-auto rounded-r-[30px] shadow-2xl">
              {sidebar}
            </div>
          </div>
        ) : null}

        {/* Content column */}
        <div className="min-w-0">
          <header className="glass-panel sticky top-0 z-30 flex min-h-16 items-center gap-3 rounded-none border-x-0 border-t-0 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="grid size-10 shrink-0 place-items-center rounded-2xl border border-white/65 bg-white/55 text-muted hover:text-ink lg:hidden"
              aria-label="Open menu"
            >
              <PanelLeft size={18} />
            </button>

            <div className="min-w-0 flex-1 pr-1 sm:border-r sm:border-white/55 sm:pr-5 md:flex-none">
              <div className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-plum">
                {chrome.name}
              </div>
              <h1 className="truncate text-[15px] font-semibold tracking-tight sm:text-base">{title}</h1>
            </div>

            <label className="hidden h-11 min-w-40 flex-1 items-center gap-2.5 rounded-[18px] border border-white/65 bg-white/50 px-3.5 text-sm text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] focus-within:border-plum md:flex">
              <Search size={16} className="shrink-0 text-faint" />
              <input
                className="w-full bg-transparent text-ink outline-none placeholder:text-faint"
                placeholder="Search clients, bookings, products…"
              />
            </label>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <ThemeModeButton />

              {/* Quick add */}
              <details className="group relative hidden sm:block">
                <summary className="flex h-11 cursor-pointer list-none items-center gap-1.5 rounded-[18px] border border-white/65 bg-white/58 px-3 text-sm font-medium text-ink hover:bg-white/75 [&::-webkit-details-marker]:hidden">
                  <Plus size={16} className="text-plum" />
                  <span className="hidden sm:inline">Quick add</span>
                </summary>
                <div className="glass-strong absolute right-0 z-40 mt-2 w-52 overflow-hidden rounded-[24px] p-1.5">
                  {quickAdd.map((q) => (
                    <Link
                      key={q.label}
                      href={`/${slug}/${q.path}`}
                      className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium text-ink hover:bg-white/55 hover:text-plum"
                    >
                      <Plus size={14} className="text-mauve" />
                      {q.label}
                    </Link>
                  ))}
                </div>
              </details>

              {/* Notifications */}
              <details className="group relative">
                <summary className="grid size-11 cursor-pointer list-none place-items-center rounded-[18px] border border-white/65 bg-white/58 text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
                  <Bell size={17} />
                </summary>
                <div className="glass-strong absolute right-0 z-40 mt-2 w-72 rounded-[26px] p-5 text-center">
                  <div className="mx-auto grid size-11 place-items-center rounded-full bg-plum-soft text-plum">
                    <Bell size={18} />
                  </div>
                  <div className="mt-3 text-sm font-semibold text-ink">You&apos;re all caught up</div>
                  <p className="mt-1 text-xs text-muted">New bookings and alerts will show up here.</p>
                </div>
              </details>

              {/* Primary action */}
              <Link
                href={`/${slug}/appointments?new=1#new-booking`}
                className="primary-action flex h-11 items-center gap-1.5 rounded-[18px] px-3 text-sm font-semibold text-white sm:px-4"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">{copy.quickAdd.booking}</span>
                <span className="sm:hidden">Book</span>
              </Link>
            </div>
          </header>

          {/* key on the route so content gently fades up on each navigation */}
          <main id="main-content" key={pathname} className="animate-fade-up px-4 py-5 sm:px-6 sm:py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
