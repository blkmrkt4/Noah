/**
 * OpenRouter client for LLM inference.
 * Configuration (API key, models, prompts, slug→model+prompt binds) lives in the database
 * and is editable via /admin. See models in prisma/schema.prisma:
 *   AdminSetting, ModelLibrary, PromptLibrary, ActivityBind.
 */

import { prisma } from "./prisma";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface OpenRouterStreamChunk {
  choices?: {
    delta?: { content?: string };
    finish_reason?: string | null;
  }[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

/** Per-chunk callback fired as content streams in from OpenRouter. */
export type LlmChunkHandler = (state: {
  contentSoFar: string;
  charCount: number;
  /** Best-effort live token estimate while the stream is running. */
  approxTokens: number;
}) => void;

/** Thrown when an LLM call is aborted by the per-call timeout. */
export class LlmTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`LLM call exceeded ${timeoutMs}ms timeout`);
    this.name = "LlmTimeoutError";
  }
}

// Default per-call timeout. Override via the optional `timeoutMs` param on
// invoke* helpers when a specific scan needs a longer/shorter window.
const DEFAULT_LLM_TIMEOUT_MS = 90_000;

let cachedKey: { value: string; loadedAt: number } | null = null;
const KEY_TTL_MS = 30_000;

async function getApiKey(): Promise<string> {
  const now = Date.now();
  if (cachedKey && now - cachedKey.loadedAt < KEY_TTL_MS) return cachedKey.value;

  const setting = await prisma.adminSetting.findUnique({
    where: { key: "openrouter_api_key" },
  });
  const value = setting?.value || process.env.OPENROUTER_API_KEY;
  if (!value) {
    throw new Error(
      "OpenRouter API key not configured. Set it at /admin/settings or via OPENROUTER_API_KEY in .env.local."
    );
  }
  cachedKey = { value, loadedAt: now };
  return value;
}

export function clearKeyCache() {
  cachedKey = null;
}

interface RawCallOptions {
  openrouterModelId: string;
  temperature: number;
  maxTokens: number;
  timeoutMs?: number;
  // External cancel signal. When fired (e.g. by the prepop loop watching
  // cancelRequested in the DB), the in-flight fetch is aborted and an
  // AbortError bubbles up. The caller distinguishes this from a timeout
  // (LlmTimeoutError) by checking the signal's aborted state.
  signal?: AbortSignal;
  // Streaming callback. Fires as deltas arrive from OpenRouter. Used by the
  // scan loops to write live progress into RepoScanRun.output (debounced).
  onChunk?: LlmChunkHandler;
}

/** Thrown when the caller's external AbortSignal fires mid-call. */
export class LlmAbortError extends Error {
  constructor() {
    super("LLM call aborted by caller");
    this.name = "LlmAbortError";
  }
}

async function rawChatWithUsage(
  messages: ChatMessage[],
  opts: RawCallOptions
): Promise<{ content: string; usage: LlmUsage }> {
  const apiKey = await getApiKey();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_LLM_TIMEOUT_MS;

  // Combine the timeout AbortController with any caller-supplied signal so a
  // single `signal` reaches fetch and we can tell which side aborted.
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);

  const callerSignal = opts.signal;
  const onCallerAbort = () => timeoutController.abort();
  if (callerSignal) {
    if (callerSignal.aborted) {
      clearTimeout(timer);
      throw new LlmAbortError();
    }
    callerSignal.addEventListener("abort", onCallerAbort, { once: true });
  }

  let response: Response;
  try {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://arc.ey.com",
        "X-Title": "ARC - Attestation Risk Compliance",
      },
      body: JSON.stringify({
        model: opts.openrouterModelId,
        messages,
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        // Stream is always on so we can surface live progress (token counts +
        // ticker text) to the UI. The function still returns one assembled
        // string at the end; only telemetry changes.
        stream: true,
      }),
      signal: timeoutController.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      if (callerSignal?.aborted) throw new LlmAbortError();
      throw new LlmTimeoutError(timeoutMs);
    }
    throw err;
  }

  if (!response.ok) {
    clearTimeout(timer);
    if (callerSignal) callerSignal.removeEventListener("abort", onCallerAbort);
    const error = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${error}`);
  }
  if (!response.body) {
    clearTimeout(timer);
    if (callerSignal) callerSignal.removeEventListener("abort", onCallerAbort);
    throw new Error("OpenRouter returned no body");
  }

  // Parse SSE stream. Each line is either "data: {...}" or "data: [DONE]".
  // We accumulate content from `delta.content` deltas and capture `usage`
  // from whichever chunk includes it (typically the final one).
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let contentSoFar = "";
  let usage: LlmUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const obj = JSON.parse(payload) as OpenRouterStreamChunk;
          const delta = obj.choices?.[0]?.delta?.content;
          if (delta) {
            contentSoFar += delta;
            if (opts.onChunk) {
              try {
                opts.onChunk({
                  contentSoFar,
                  charCount: contentSoFar.length,
                  approxTokens: Math.round(contentSoFar.length / 4),
                });
              } catch {
                // Caller's onChunk threw — don't let that kill the stream.
              }
            }
          }
          if (obj.usage) {
            usage = {
              promptTokens: obj.usage.prompt_tokens ?? 0,
              completionTokens: obj.usage.completion_tokens ?? 0,
              totalTokens: obj.usage.total_tokens ?? 0,
            };
          }
        } catch {
          // Malformed/partial JSON line — skip; the next read merges it.
        }
      }
    }
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      if (callerSignal?.aborted) throw new LlmAbortError();
      throw new LlmTimeoutError(timeoutMs);
    }
    throw err;
  } finally {
    clearTimeout(timer);
    if (callerSignal) callerSignal.removeEventListener("abort", onCallerAbort);
  }

  // Some providers don't emit usage during streaming. Fall back to the
  // char/4 estimate so the caller at least gets a non-zero count.
  if (usage.totalTokens === 0 && contentSoFar.length > 0) {
    usage = {
      promptTokens: 0,
      completionTokens: Math.round(contentSoFar.length / 4),
      totalTokens: Math.round(contentSoFar.length / 4),
    };
  }

  return { content: contentSoFar, usage };
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

/**
 * Invoke a configured bind. Looks up the slug → ActivityBind → Model + Prompt,
 * substitutes {{vars}} into the prompt template, and returns the raw LLM string.
 */
export interface InvokeBindOptions {
  /** Per-call timeout. Falls back to DEFAULT_LLM_TIMEOUT_MS. */
  timeoutMs?: number;
  /** Override the model's configured maxTokens for this call only. */
  maxTokens?: number;
  /** External cancel signal — when it aborts, the in-flight fetch aborts. */
  signal?: AbortSignal;
  /** Per-chunk telemetry callback. Fires as content streams in. */
  onChunk?: LlmChunkHandler;
}

export async function invokeBind(
  slug: string,
  vars: Record<string, string>,
  opts: InvokeBindOptions = {}
): Promise<string> {
  const { content } = await invokeBindWithUsage(slug, vars, opts);
  return content;
}

/**
 * Same as invokeBind but also returns OpenRouter usage stats. Use this when
 * the caller wants to sum tokens across many calls (e.g. the prepop loop).
 */
export async function invokeBindWithUsage(
  slug: string,
  vars: Record<string, string>,
  opts: InvokeBindOptions = {}
): Promise<{ content: string; usage: LlmUsage }> {
  const bind = await prisma.activityBind.findUnique({
    where: { slug },
    include: { model: true, prompt: true },
  });
  if (!bind) {
    throw new Error(`No ActivityBind for slug "${slug}". Create one at /admin.`);
  }

  const userPrompt = renderTemplate(bind.prompt.userPromptTemplate, vars);

  return rawChatWithUsage(
    [
      { role: "system", content: bind.prompt.systemPrompt },
      { role: "user", content: userPrompt },
    ],
    {
      openrouterModelId: bind.model.openrouterModelId,
      temperature: bind.model.temperature,
      maxTokens: opts.maxTokens ?? bind.model.maxTokens,
      timeoutMs: opts.timeoutMs,
      signal: opts.signal,
      onChunk: opts.onChunk,
    }
  );
}

/** Same as invokeBind, but parses the response as JSON. */
export async function invokeBindJson<T>(
  slug: string,
  vars: Record<string, string>,
  opts: InvokeBindOptions = {}
): Promise<T> {
  const raw = await invokeBind(slug, vars, opts);
  return JSON.parse(stripCodeFences(raw)) as T;
}

/** Same as invokeBindJson, but also returns usage stats. */
export async function invokeBindJsonWithUsage<T>(
  slug: string,
  vars: Record<string, string>,
  opts: InvokeBindOptions = {}
): Promise<{ value: T; usage: LlmUsage }> {
  const { content, usage } = await invokeBindWithUsage(slug, vars, opts);
  return {
    value: JSON.parse(stripCodeFences(content)) as T,
    usage,
  };
}

function stripCodeFences(s: string): string {
  const trimmed = s.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  }
  return trimmed;
}
