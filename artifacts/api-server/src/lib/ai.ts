import OpenAI from "openai";

function getOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey: key });
}

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

export async function generateOpenAIMessage(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 400,
): Promise<string> {
  return openAIGenerate(systemPrompt, userPrompt, maxTokens);
}

export async function generateClaudeMessage(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 1200,
): Promise<string> {
  return openAIGenerate(systemPrompt, userPrompt, maxTokens);
}

export function buildToneDescription(tones: string[]): string {
  if (!tones || tones.length === 0) return "warm, caring, and professional";
  return tones.join(", ");
}
