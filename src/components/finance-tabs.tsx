import Link from "next/link";

const tabs = [
  { key: "overview", label: "Overview", path: "finance" },
  { key: "expenses", label: "Expenses", path: "finance/expenses" },
] as const;

export function FinanceTabs({ businessSlug, active }: { businessSlug: string; active: "overview" | "expenses" }) {
  return (
    <div className="glass-panel flex w-fit gap-1 rounded-[20px] p-1">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={`/${businessSlug}/${tab.path}`}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-2xl px-3.5 py-1.5 text-[13px] font-semibold transition ${
              isActive ? "primary-action text-white" : "text-muted hover:bg-white/55 hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
