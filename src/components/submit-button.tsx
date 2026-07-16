"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

// Drop-in submit button that reflects the parent <form>'s pending state:
// disables itself and shows a spinner while the server action runs, so every
// save has immediate feedback. Must be rendered inside a <form>.
export function SubmitButton({
  children,
  className,
  pendingText,
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={className}>
      <span className="inline-flex items-center justify-center gap-2">
        {pending ? <Loader2 size={16} className="animate-spin" /> : null}
        {pending ? pendingText ?? children : children}
      </span>
    </button>
  );
}
