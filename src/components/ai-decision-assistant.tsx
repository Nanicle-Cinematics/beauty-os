"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { Bot, Send, UserRound, Loader2, Sparkles } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const starters = [
  "What should I do first today?",
  "Where am I losing money?",
  "Draft messages for clients I should contact.",
  "How can I fill my calendar this week?",
];

export function AiDecisionAssistant({ businessSlug }: { businessSlug: string }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Ask me anything about your studio. I can reason across deposits, bookings, invoices, inventory, staff, retention, marketing, and what to do next.",
    },
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<"openai" | "fallback" | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const canSend = input.trim().length > 0 && !pending;
  const visibleMessages = useMemo(() => messages.slice(-12), [messages]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;

    const nextMessages: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setPending(true);

    try {
      const response = await fetch(`/${businessSlug}/ai-insights/assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = (await response.json().catch(() => ({}))) as { reply?: string; mode?: "openai" | "fallback"; error?: string };
      setMode(data.mode ?? null);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.reply || data.error || "I could not answer that yet. Try asking for priorities, cash risk, marketing, inventory, or scheduling.",
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        { role: "assistant", content: "I could not reach the assistant service. Check the deployment environment and try again." },
      ]);
    } finally {
      setPending(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <section className="card overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/45 bg-white/25 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="icon-chip grid size-11 place-items-center rounded-[20px] bg-plum-soft text-plum">
            <Bot size={20} />
          </span>
          <div>
            <h2 className="text-[16px] font-semibold text-ink">Ask Beauty OS</h2>
            <p className="text-[12.5px] text-muted">A conversational decision assistant grounded in this workspace.</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-muted">
          <Sparkles size={12} /> {mode === "openai" ? "Live AI" : mode === "fallback" ? "Local fallback" : "Ready"}
        </span>
      </div>

      <div className="grid max-h-[560px] gap-3 overflow-y-auto px-5 py-5">
        {visibleMessages.map((message, index) => {
          const assistant = message.role === "assistant";
          return (
            <div key={`${message.role}-${index}-${message.content.slice(0, 16)}`} className={`flex gap-3 ${assistant ? "" : "justify-end"}`}>
              {assistant ? (
                <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-plum-soft text-plum">
                  <Bot size={17} />
                </span>
              ) : null}
              <div
                className={`max-w-[min(760px,88%)] whitespace-pre-wrap rounded-[22px] px-4 py-3 text-[13.5px] leading-6 ${
                  assistant
                    ? "border border-white/55 bg-white/45 text-ink"
                    : "primary-action text-white"
                }`}
              >
                {message.content}
              </div>
              {!assistant ? (
                <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-white/55 text-muted">
                  <UserRound size={17} />
                </span>
              ) : null}
            </div>
          );
        })}
        {pending ? (
          <div className="flex items-center gap-2 text-[13px] font-semibold text-muted">
            <Loader2 size={16} className="animate-spin" /> Thinking through live studio context...
          </div>
        ) : null}
      </div>

      <div className="border-t border-white/45 bg-white/24 px-5 py-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {starters.map((starter) => (
            <button
              key={starter}
              type="button"
              onClick={() => void sendMessage(starter)}
              disabled={pending}
              className="rounded-full border border-white/60 bg-white/45 px-3 py-1.5 text-[12px] font-semibold text-muted hover:bg-white/70 hover:text-ink disabled:opacity-50"
            >
              {starter}
            </button>
          ))}
        </div>
        <form ref={formRef} onSubmit={onSubmit} className="flex gap-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                formRef.current?.requestSubmit();
              }
            }}
            placeholder="Ask: Should I chase deposits first, run a campaign, reorder stock, or adjust staff?"
            className="min-h-12 flex-1 resize-none rounded-[20px] border border-white/60 bg-white/48 px-4 py-3 text-sm text-ink outline-none focus:border-plum"
            rows={1}
          />
          <button
            type="submit"
            disabled={!canSend}
            className="primary-action grid size-12 shrink-0 place-items-center rounded-[20px] text-white disabled:opacity-50"
            aria-label="Send message"
          >
            {pending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </form>
      </div>
    </section>
  );
}
