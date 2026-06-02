import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

function getOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey: key });
}

function getClaude(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey: key });
}

// Detect errors that mean "Claude credits are exhausted / billing problem" —
// these should trigger an automatic failover to OpenAI. Transient errors
// (timeouts, 500s) are NOT failover-worthy on their own but we still fall back
// rather than fail the patient message.
function isClaudeUnavailable(err: unknown): boolean {
  const e = err as { status?: number; error?: { type?: string }; message?: string };
  const status = e?.status;
  const msg = (e?.message ?? "").toLowerCase();
  // 401 = bad/expired key, 402/403 = billing/credit, 429 = rate/quota exhausted
  if (status === 401 || status === 402 || status === 403 || status === 429) return true;
  if (msg.includes("credit") || msg.includes("billing") || msg.includes("quota") || msg.includes("insufficient")) return true;
  // 5xx — Claude is down, fall back rather than drop the message
  if (status !== undefined && status >= 500) return true;
  return false;
}

// ── OpenAI generation ─────────────────────────────────────────────────────────
async function openAIGenerate(systemPrompt: string, userPrompt: string, maxTokens: number): Promise<string> {
  const openai = getOpenAI();
  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: maxTokens,
    temperature: 0.8,
  });
  return resp.choices[0]?.message?.content?.trim() ?? "";
}

// ── Claude generation ─────────────────────────────────────────────────────────
async function claudeGenerate(systemPrompt: string, userPrompt: string, maxTokens: number): Promise<string> {
  const claude = getClaude();
  const resp = await claude.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  const block = resp.content[0];
  if (block.type !== "text") throw new Error("Unexpected Claude response type");
  return block.text.trim();
}

// ── Public functions ──────────────────────────────────────────────────────────
// Both AI entry points try Claude first, then automatically fall back to OpenAI
// if Claude is unavailable (credits exhausted, billing issue, or service down).
// This means when Anthropic credits run out, patient messages keep flowing via
// OpenAI with no manual change. If OpenAI also has no key, the original error
// is surfaced so it's logged in Sentry.

async function generateWithFailover(systemPrompt: string, userPrompt: string, maxTokens: number): Promise<string> {
  try {
    return await claudeGenerate(systemPrompt, userPrompt, maxTokens);
  } catch (claudeErr) {
    if (!isClaudeUnavailable(claudeErr)) {
      // Not a credit/availability issue (e.g. bad prompt) — still try OpenAI as a
      // last resort so the patient message is not lost, but log the original.
      console.error("[ai] Claude error (non-billing):", claudeErr instanceof Error ? claudeErr.message : claudeErr);
    } else {
      console.warn("[ai] Claude unavailable — failing over to OpenAI:", claudeErr instanceof Error ? claudeErr.message : claudeErr);
    }
    if (!process.env.OPENAI_API_KEY) {
      // No fallback available — surface the original Claude error
      throw claudeErr;
    }
    return await openAIGenerate(systemPrompt, userPrompt, maxTokens);
  }
}

export async function generateOpenAIMessage(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 400,
): Promise<string> {
  return generateWithFailover(systemPrompt, userPrompt, maxTokens);
}

export async function generateClaudeMessage(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 1200,
): Promise<string> {
  return generateWithFailover(systemPrompt, userPrompt, maxTokens);
}

export function buildToneDescription(tones: string[]): string {
  if (!tones || tones.length === 0) return "warm, caring, and professional";
  return tones.join(", ");
}
