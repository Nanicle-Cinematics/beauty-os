"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

type ToastType = "success" | "error";
type ToastItem = { id: number; message: string; type: ToastType };

// Tiny module-level pub/sub so any code can fire a toast without a provider.
let counter = 0;
const listeners = new Set<(t: ToastItem) => void>();

export function toast(message: string, type: ToastType = "success") {
  if (!message) return;
  listeners.forEach((listener) => listener({ id: ++counter, message, type }));
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (t: ToastItem) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), 3800);
    };
    listeners.add(onToast);
    return () => {
      listeners.delete(onToast);
    };
  }, []);

  const dismiss = (id: number) => setItems((prev) => prev.filter((x) => x.id !== id));

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          aria-live="polite"
          className={`animate-fade-up pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-[var(--shadow-lift)] ${
            t.type === "error" ? "border-danger/25 bg-danger-soft text-danger" : "border-plum/20 bg-card text-ink"
          }`}
        >
          {t.type === "error" ? (
            <AlertCircle size={17} className="mt-0.5 shrink-0 text-danger" />
          ) : (
            <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-plum" />
          )}
          <span className="flex-1 leading-5">{t.message}</span>
          <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="shrink-0 text-faint hover:text-ink">
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}
