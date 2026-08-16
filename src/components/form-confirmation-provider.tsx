"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";

type Submitter = HTMLButtonElement | HTMLInputElement;

type PendingSubmit = {
  form: HTMLFormElement;
  submitter: Submitter | null;
  title: string;
  body: string;
  actionLabel: string;
  tone: "normal" | "danger";
};

const bypassRoutes = [
  "/login",
  "/signup",
  "/invite",
  "/verify",
  "/verify-email",
  "/sso",
  "/logout",
];

function visibleText(value: string | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function submitterLabel(submitter: Submitter | null) {
  if (!submitter) return "Submit";
  if (submitter instanceof HTMLInputElement) return visibleText(submitter.value) || "Submit";
  return visibleText(submitter.innerText || submitter.textContent) || submitter.getAttribute("aria-label") || "Submit";
}

function isWriteForm(form: HTMLFormElement) {
  const method = form.getAttribute("method")?.toLowerCase() ?? form.method.toLowerCase();
  return method !== "get";
}

function isDestructive(label: string) {
  return /\b(delete|remove|refund|void|revoke|retire|cancel|archive|disable)\b/i.test(label);
}

function copyFor(label: string, form: HTMLFormElement, submitter: Submitter | null): PendingSubmit {
  const explicitTitle = visibleText(form.dataset.confirmTitle || submitter?.dataset.confirmTitle);
  const explicitBody = visibleText(form.dataset.confirmBody || submitter?.dataset.confirmBody);
  const actionLabel = label || "Continue";
  const danger = isDestructive(actionLabel);

  return {
    form,
    submitter,
    title: explicitTitle || (danger ? "Confirm this permanent action" : "Confirm before saving"),
    body:
      explicitBody ||
      (danger
        ? "This will write a real change to Beauty OS. Review the details before continuing."
        : "This will save changes to the workspace. Confirm that the details are correct before they are written."),
    actionLabel,
    tone: danger ? "danger" : "normal",
  };
}

export function FormConfirmationProvider() {
  const pathname = usePathname() ?? "";
  const [pending, setPending] = useState<PendingSubmit | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const allowedOnce = useRef<WeakSet<HTMLFormElement>>(new WeakSet());

  const routeBypassed = useMemo(
    () => bypassRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`)),
    [pathname],
  );

  useEffect(() => {
    if (routeBypassed) return;

    const onSubmit = (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (!isWriteForm(form)) return;
      if (form.dataset.confirmBypass === "true") return;

      const submitter = event.submitter instanceof HTMLButtonElement || event.submitter instanceof HTMLInputElement
        ? event.submitter
        : null;
      if (submitter?.dataset.confirmBypass === "true") return;
      if (allowedOnce.current.has(form)) {
        allowedOnce.current.delete(form);
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      setSubmitting(false);
      setPending(copyFor(submitterLabel(submitter), form, submitter));
    };

    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, [routeBypassed]);

  useEffect(() => {
    if (!pending) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPending(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [pending]);

  if (!pending) return null;

  const confirm = () => {
    setSubmitting(true);
    allowedOnce.current.add(pending.form);
    pending.form.requestSubmit(pending.submitter);
    setPending(null);
  };

  const danger = pending.tone === "danger";

  return (
    <div className="fixed inset-0 z-[300] grid place-items-center bg-ink/38 px-4 py-6 backdrop-blur-md" role="presentation">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="form-confirm-title"
        aria-describedby="form-confirm-body"
        className="glass-strong relative w-full max-w-md overflow-hidden rounded-[30px]"
      >
        <div className="absolute -right-10 -top-10 size-32 rounded-[42px] bg-rose/15 blur-2xl" aria-hidden />
        <div className="absolute -bottom-14 left-8 size-36 rounded-[46px] bg-aqua/15 blur-2xl" aria-hidden />
        <div className={`relative h-1.5 ${danger ? "bg-danger" : "bg-gradient-to-r from-rose via-mauve to-aqua"}`} />
        <div className="p-5">
          <div className="flex items-start gap-3">
            <span className={`icon-chip grid size-12 shrink-0 place-items-center rounded-[22px] ${danger ? "bg-danger-soft text-danger" : "bg-plum-soft text-plum"}`}>
              {danger ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
            </span>
            <div className="min-w-0">
              <h2 id="form-confirm-title" className="text-lg font-semibold tracking-tight text-ink">
                {pending.title}
              </h2>
              <p id="form-confirm-body" className="mt-1 text-sm leading-6 text-muted">
                {pending.body}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPending(null)}
              className="ml-auto grid size-10 shrink-0 place-items-center rounded-2xl text-muted hover:bg-white/55 hover:text-ink"
              aria-label="Cancel confirmation"
              disabled={submitting}
            >
              <X size={17} />
            </button>
          </div>

          <div className="mt-5 rounded-[22px] border border-white/60 bg-white/45 p-3 text-[13px] font-medium text-ink">
            Action: <span className="font-semibold">{pending.actionLabel}</span>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setPending(null)}
              className="rounded-2xl border border-white/65 bg-white/48 px-4 py-2.5 text-sm font-semibold text-ink hover:bg-white/70"
              disabled={submitting}
            >
              Go back
            </button>
            <button
              type="button"
              onClick={confirm}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white ${
                danger ? "bg-danger shadow-[0_10px_24px_rgba(176,74,69,0.28)] hover:brightness-105" : "primary-action hover:brightness-105"
              }`}
              disabled={submitting}
              autoFocus
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
              {submitting ? "Continuing..." : `Yes, ${pending.actionLabel.toLowerCase()}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
