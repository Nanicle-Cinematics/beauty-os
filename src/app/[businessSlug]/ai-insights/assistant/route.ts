import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth";
import { getAiAssistantContext } from "@/lib/ai-assistant-context";

export const dynamic = "force-dynamic";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type RouteParams = {
  params: Promise<{ businessSlug: string }>;
};

const MAX_MESSAGES = 12;
const MAX_CHARS = 1400;

function cleanMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((message): message is ChatMessage => {
      return (
        message != null &&
        typeof message === "object" &&
        (message as ChatMessage).role !== undefined &&
        ["user", "assistant"].includes((message as ChatMessage).role) &&
        typeof (message as ChatMessage).content === "string"
      );
    })
    .slice(-MAX_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: message.content.slice(0, MAX_CHARS),
    }));
}

// Answers built from the tenant's own numbers, used whenever the language model
// is unavailable. These strings are read by salon owners, so they must never
// name server configuration — the UI already shows a "Quick answer" badge when
// this path runs, which is all the mode signal a customer needs. End each reply
// on something the reader can actually go and do.
function fallbackReply(question: string, context: Awaited<ReturnType<typeof getAiAssistantContext>>) {
  const firstInsight = context?.insights[0];
  const quickAction = firstInsight?.steps?.[0] ?? "Review AI Insights and start with the highest-priority card.";
  const lower = question.toLowerCase();

  if (lower.includes("deposit") || lower.includes("payment") || lower.includes("cash")) {
    return `Start with cash security. Beauty OS currently shows ${context?.moneyAtRisk ?? "some money"} at risk. First action: ${quickAction}\n\nOpen Payments to see exactly who still owes you.`;
  }

  if (lower.includes("marketing") || lower.includes("message") || lower.includes("campaign")) {
    const draft = firstInsight?.draft ?? "Hi, a few appointment slots opened this week. Reply with your preferred day and we will help you book in.";
    return `Use a focused campaign, not a broad discount. Draft copy:\n\n${draft}\n\nYou can send this from Marketing — edit it to sound like you before it goes out.`;
  }

  if (lower.includes("today") || lower.includes("priority") || lower.includes("do first")) {
    return `Do this first: ${quickAction}\n\nCurrent focus: ${context?.focus ?? "No urgent focus available"}.`;
  }

  return `Based on your live numbers, the current focus is: ${context?.focus ?? "No urgent focus available"}.\n\nRecommended first move: ${quickAction}\n\nAsk me about cash, bookings, marketing, inventory, or staffing for a more specific answer.`;
}

function systemPrompt(context: Awaited<ReturnType<typeof getAiAssistantContext>>) {
  return `You are Beauty OS Decision Assistant, a ChatGPT-style operating assistant for a beauty studio.

Your job:
- Answer the user's operational questions with direct business advice.
- Use only the tenant-scoped Beauty OS context provided below.
- Prioritize money at risk, calendar capacity, deposits, overdue invoices, holds, inventory risk, retention, staff utilization, and marketing opportunities.
- Be concrete: name the exact action, explain why, give steps, and draft client/staff messages when helpful.
- If the user asks you to perform a write action, do not claim it is done. Tell them which Beauty OS page/action to use.
- Do not invent client names, payments, invoices, services, or stock levels beyond the context.
- Keep answers concise but useful. Prefer short sections and bullet points.
- For medical, legal, tax, or regulated advice, give operational guidance only and suggest consulting a qualified professional.

Tenant context:
${JSON.stringify(context, null, 2)}`;
}

function extractResponsesText(data: unknown) {
  if (!data || typeof data !== "object") return "";
  const record = data as { output_text?: unknown; output?: unknown };
  if (typeof record.output_text === "string") return record.output_text;
  if (!Array.isArray(record.output)) return "";
  const parts: string[] = [];
  for (const item of record.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (!block || typeof block !== "object") continue;
      const text = (block as { text?: unknown }).text;
      if (typeof text === "string") parts.push(text);
    }
  }
  return parts.join("\n").trim();
}

export async function POST(request: Request, { params }: RouteParams) {
  const { businessSlug } = await params;
  await requireTenantAccess(businessSlug);

  const body = (await request.json().catch(() => ({}))) as { messages?: unknown };
  const messages = cleanMessages(body.messages);
  const latest = [...messages].reverse().find((message) => message.role === "user");
  if (!latest) {
    return NextResponse.json({ error: "Send a message first." }, { status: 400 });
  }

  const context = await getAiAssistantContext(businessSlug);
  if (!context) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ reply: fallbackReply(latest.content, context), mode: "fallback" });
  }

  const input = messages.map((message) => ({
    role: message.role,
    content: [{ type: "input_text", text: message.content }],
  }));

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.1",
      instructions: systemPrompt(context),
      input,
      max_output_tokens: 900,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("OpenAI assistant request failed", response.status, detail.slice(0, 500));
    return NextResponse.json({ reply: fallbackReply(latest.content, context), mode: "fallback" });
  }

  const data = await response.json();
  const reply = extractResponsesText(data);
  return NextResponse.json({
    reply: reply || fallbackReply(latest.content, context),
    mode: reply ? "openai" : "fallback",
  });
}
