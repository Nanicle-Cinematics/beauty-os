"use client";

import { TriangleAlert } from "lucide-react";
import { deleteWorkspaceAction, deleteAccountAction } from "@/lib/account-actions";

type Workspace = { id: string; name: string; slug: string };

export function DangerZone({ ownedWorkspaces }: { ownedWorkspaces: Workspace[] }) {
  const canDeleteAccount = ownedWorkspaces.length === 0;

  return (
    <section className="grid gap-4 rounded-[var(--radius-card)] border border-danger/25 bg-danger-soft/40 p-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-danger">
          <TriangleAlert size={18} /> Danger zone
        </h2>
        <p className="mt-0.5 text-sm text-muted">Permanent, irreversible actions.</p>
      </div>

      {ownedWorkspaces.map((w) => (
        <form
          key={w.id}
          action={deleteWorkspaceAction}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-danger/20 bg-card p-3.5"
        >
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold text-ink">Delete “{w.name}”</div>
            <p className="text-[12px] text-muted">Removes the workspace and all of its data (clients, bookings, payments — everything).</p>
          </div>
          <input type="hidden" name="businessId" value={w.id} />
          <button
            type="submit"
            onClick={(e) => {
              const typed = window.prompt(
                `Permanently delete “${w.name}” and ALL its data? This cannot be undone.\n\nType the slug "${w.slug}" to confirm:`,
              );
              if (typed !== w.slug) e.preventDefault();
            }}
            className="shrink-0 rounded-xl border border-danger/30 bg-card px-4 py-2 text-sm font-semibold text-danger hover:bg-danger-soft"
          >
            Delete workspace
          </button>
        </form>
      ))}

      <form
        action={deleteAccountAction}
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-danger/20 bg-card p-3.5"
      >
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold text-ink">Delete your account</div>
          <p className="text-[12px] text-muted">
            {canDeleteAccount
              ? "Removes your login, sessions, and personal data."
              : "Delete the workspaces you own (above) before you can delete your account."}
          </p>
        </div>
        <button
          type="submit"
          disabled={!canDeleteAccount}
          onClick={(e) => {
            const typed = window.prompt("Permanently delete your account? Type DELETE to confirm:");
            if (typed !== "DELETE") e.preventDefault();
          }}
          className="shrink-0 rounded-xl border border-danger/30 bg-card px-4 py-2 text-sm font-semibold text-danger hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          Delete account
        </button>
      </form>
    </section>
  );
}
