import Link from "next/link";

const tabs = [
  { key: "overview", label: "Overview", path: "finance" },
  { key: "expenses", label: "Expenses", path: "finance/expenses" },
] as const;

export function FinanceTabs({ businessSlug, active }: { businessSlug: string; active: "overview" | "expenses" }) {
  return (
    <div className="flex w-fit gap-1 rounded-xl border border-line bg-card p-1">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={`/${businessSlug}/${tab.path}`}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition ${
              isActive ? "bg-gradient-to-r from-plum to-wine text-white shadow-[0_4px_12px_rgba(84,33,63,0.25)]" : "text-muted hover:bg-sunken hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
