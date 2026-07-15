"use client";

import { useActionState } from "react";
import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui";
import {
  startMfaAction,
  confirmMfaAction,
  disableMfaAction,
  regenerateRecoveryAction,
  type MfaActionState,
} from "@/lib/mfa-actions";

type Status = { configured: boolean; enabled: boolean; pending: boolean; recoveryRemaining: number };
const empty: MfaActionState = {};

function RecoveryCodes({ codes }: { codes: string[] }) {
  return (
    <div className="rounded-2xl border border-warning/25 bg-warning-soft p-4">
      <div className="text-[13px] font-semibold text-ink">Save your recovery codes</div>
      <p className="mt-1 text-[12px] leading-5 text-muted">
        Each code works once if you lose your device. Store them somewhere safe — they won&apos;t be shown again.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-1.5 font-mono text-[13px] text-ink max-[420px]:grid-cols-1">
        {codes.map((c) => (
          <div key={c} className="rounded-lg bg-card px-2.5 py-1.5 tracking-wide">{c}</div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => window.location.assign("/settings")}
        className="mt-3 inline-block text-[12.5px] font-semibold text-plum hover:underline"
      >
        I&apos;ve saved them →
      </button>
    </div>
  );
}

const codeInput = "input text-center tracking-[0.25em]";

export function TwoFactor({ status, enrollment }: { status: Status; enrollment: { qr: string; secret: string } | null }) {
  const [confirmState, confirmAction] = useActionState(confirmMfaAction, empty);
  const [disableState, disableAction] = useActionState(disableMfaAction, empty);
  const [regenState, regenAction] = useActionState(regenerateRecoveryAction, empty);

  const codes = confirmState.recoveryCodes ?? regenState.recoveryCodes;

  return (
    <section className="card grid gap-4 p-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck size={18} className="text-plum" /> Two-factor authentication
        </h2>
        <p className="mt-0.5 text-sm text-muted">Require a one-time code from your phone when you sign in.</p>
      </div>

      {codes ? (
        <RecoveryCodes codes={codes} />
      ) : !status.configured ? (
        <div className="rounded-xl border border-line bg-sunken px-4 py-3 text-sm text-muted">
          Two-factor isn&apos;t configured on this server yet.
        </div>
      ) : status.enabled ? (
        <div className="grid gap-4">
          <div className="flex items-center gap-2">
            <Badge tone="success">On</Badge>
            <span className="text-[13px] text-muted">
              {status.recoveryRemaining} recovery {status.recoveryRemaining === 1 ? "code" : "codes"} left
            </span>
          </div>

          <form action={regenAction} className="grid gap-2 rounded-2xl border border-line-2 p-3.5">
            <div className="text-[12.5px] font-semibold text-ink">Regenerate recovery codes</div>
            <p className="text-[12px] text-muted">Invalidates old codes. Enter a current code to confirm.</p>
            {regenState.error ? <div className="text-[12px] font-semibold text-danger">{regenState.error}</div> : null}
            <div className="flex gap-2">
              <input name="code" inputMode="text" autoComplete="one-time-code" placeholder="Code" className={`${codeInput} flex-1`} required />
              <button className="rounded-xl border border-line px-4 text-sm font-medium text-muted hover:border-plum-line hover:bg-plum-soft hover:text-plum">Regenerate</button>
            </div>
          </form>

          <form action={disableAction} className="grid gap-2 rounded-2xl border border-danger/20 bg-danger-soft/40 p-3.5">
            <div className="text-[12.5px] font-semibold text-ink">Turn off two-factor</div>
            <p className="text-[12px] text-muted">Enter a current code or recovery code to disable.</p>
            {disableState.error ? <div className="text-[12px] font-semibold text-danger">{disableState.error}</div> : null}
            <div className="flex gap-2">
              <input name="code" inputMode="text" autoComplete="one-time-code" placeholder="Code" className={`${codeInput} flex-1`} required />
              <button className="rounded-xl border border-danger/30 px-4 text-sm font-medium text-danger hover:bg-danger-soft">Turn off</button>
            </div>
          </form>
        </div>
      ) : status.pending && enrollment ? (
        <div className="grid gap-4">
          <ol className="grid gap-1.5 text-[13px] text-muted">
            <li>1. Scan this QR with Google Authenticator, Authy, or 1Password.</li>
            <li>2. Enter the 6-digit code it shows to finish.</li>
          </ol>
          <div className="flex flex-wrap items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enrollment.qr} alt="Two-factor QR code" width={180} height={180} className="rounded-xl border border-line" />
            <div className="min-w-0">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted">Or enter this key manually</div>
              <code className="mt-1 block break-all rounded-lg bg-sunken px-2.5 py-1.5 font-mono text-[12px] text-ink">{enrollment.secret}</code>
            </div>
          </div>
          <form action={confirmAction} className="grid gap-2">
            {confirmState.error ? <div className="text-[12.5px] font-semibold text-danger">{confirmState.error}</div> : null}
            <div className="flex gap-2">
              <input name="code" inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="123456" className={`${codeInput} flex-1`} required />
              <button className="rounded-xl bg-gradient-to-r from-plum to-wine px-5 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(84,33,63,0.28)]">Verify &amp; turn on</button>
            </div>
          </form>
        </div>
      ) : (
        <form action={startMfaAction}>
          <button className="rounded-xl bg-gradient-to-r from-plum to-wine px-4 py-2.5 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(84,33,63,0.28)]">
            Enable two-factor
          </button>
        </form>
      )}
    </section>
  );
}
