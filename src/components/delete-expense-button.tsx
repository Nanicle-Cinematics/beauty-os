"use client";

import { Trash2 } from "lucide-react";
import { deleteExpenseAction } from "@/lib/finance-actions";

export function DeleteExpenseButton({ businessSlug, expenseId, label }: { businessSlug: string; expenseId: string; label: string }) {
  return (
    <form
      action={deleteExpenseAction}
      onSubmit={(e) => {
        if (!window.confirm(`Delete this expense (${label})? This can't be undone.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="businessSlug" value={businessSlug} />
      <input type="hidden" name="expenseId" value={expenseId} />
      <button
        type="submit"
        aria-label="Delete expense"
        className="grid size-8 place-items-center rounded-lg border border-line text-muted hover:border-danger/30 hover:bg-danger-soft hover:text-danger"
      >
        <Trash2 size={15} />
      </button>
    </form>
  );
}
