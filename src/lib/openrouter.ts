/**
 * OpenRouter client for LLM inference.
 * Supports multiple models — route by task complexity.
 */

export type ModelTier = "heavy" | "medium" | "light";

const MODEL_MAP: Record<ModelTier, string> = {
  heavy: "anthropic/claude-sonnet-4", // complex reasoning, document analysis
  medium: "qwen/qwen3-235b-a22b",    // pre-population, extraction
  light: "qwen/qwen3-30b-a3b",       // simple classification, yes/no
};

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterResponse {
  choices: {
    message: { content: string };
    finish_reason: string;
  }[];
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export async function chat(
  messages: ChatMessage[],
  tier: ModelTier = "medium",
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || apiKey === "your-key-here") {
    throw new Error("OPENROUTER_API_KEY not configured");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://arc.ey.com",
      "X-Title": "ARC - Attestation Risk Compliance",
    },
    body: JSON.stringify({
      model: MODEL_MAP[tier],
      messages,
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens ?? 4096,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${error}`);
  }

  const data = (await response.json()) as OpenRouterResponse;
  return data.choices[0]?.message?.content ?? "";
}

/**
 * Structured extraction — returns JSON parsed from the LLM response.
 */
export async function extractJson<T>(
  prompt: string,
  context: string,
  tier: ModelTier = "medium"
): Promise<T> {
  const response = await chat(
    [
      {
        role: "system",
        content:
          "You are a structured data extraction assistant. Always respond with valid JSON only, no markdown fences or explanation.",
      },
      { role: "user", content: `${prompt}\n\nContext:\n${context}` },
    ],
    tier,
    { temperature: 0.1 }
  );

  return JSON.parse(response) as T;
}
