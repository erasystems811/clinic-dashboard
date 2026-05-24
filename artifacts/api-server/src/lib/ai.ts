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

export async function generateOpenAIMessage(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 400,
): Promise<string> {
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

export async function generateClaudeMessage(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 1000,
): Promise<string> {
  const claude = getClaude();
  const resp = await claude.messages.create({
    model: "claude-3-5-haiku-20241022",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  const block = resp.content[0];
  if (block.type !== "text") throw new Error("Unexpected Claude response type");
  return block.text.trim();
}

export function buildToneDescription(tones: string[]): string {
  if (!tones || tones.length === 0) return "warm, caring, and professional";
  return tones.join(", ");
}
