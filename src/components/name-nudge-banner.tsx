import { Sparkles, X } from "lucide-react";
import { renameBusinessAction, dismissNameNudgeAction } from "@/lib/name-nudge-actions";
import { SubmitButton } from "@/components/submit-button";

// Shown at the top of the workspace when the business still has its signup-time
// placeholder name (e.g. a Google JIT signup auto-named "<name>'s Studio").
// Lets the owner set a real name inline, or dismiss to keep the current one.
export function NameNudgeBanner({ slug, currentName }: { slug: string; currentName: string }) {
  return (
    <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-plum/25 bg-gradient-to-r from-plum/5 to-wine/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-plum to-wine text-white">
          <Sparkles size={16} />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">Finish setting up — name your studio</p>
          <p className="text-xs leading-5 text-muted">
            Your workspace is currently “{currentName}”. Set your real business name — it shows on
            client-facing pages and receipts.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <form action={renameBusinessAction} className="flex items-center gap-2">
          <input type="hidden" name="slug" value={slug} />
          <input
            name="name"
            defaultValue={currentName}
            maxLength={60}
            required
            placeholder="Business name"
            aria-label="Business name"
            className="h-10 w-44 rounded-[18px] border border-white/60 bg-white/50 px-3 text-sm text-ink outline-none focus:border-plum"
          />
          <SubmitButton className="h-10 shrink-0 rounded-xl primary-action px-4 text-sm font-semibold text-white" pendingText="Saving…">
            Save
          </SubmitButton>
        </form>
        <form action={dismissNameNudgeAction}>
          <input type="hidden" name="slug" value={slug} />
          <button
            aria-label="Dismiss"
            className="grid size-9 place-items-center rounded-xl border border-line text-muted hover:bg-sunken"
          >
            <X size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}
