import OpenAI, { APIError, APIConnectionTimeoutError } from "openai";
import { getDeepSeekApiKey } from "@/lib/settings";

// DeepSeek speaks the OpenAI Chat Completions protocol, so the official SDK
// works unchanged when pointed at its base URL.
const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

/**
 * A DeepSeek client using the platform key. Throws NoDeepSeekApiKeyError if it isn't configured.
 * `maxRetries` is the SDK's own retry on timeouts/5xx — each retry can wait the full `timeoutMs` again.
 */
export function createDeepSeekClient(timeoutMs: number, maxRetries = 1): OpenAI {
  return new OpenAI({
    apiKey: getDeepSeekApiKey(),
    baseURL: DEEPSEEK_BASE_URL,
    maxRetries,
    timeout: timeoutMs,
  });
}

/** Maps raw SDK errors from DeepSeek to a clear, user-facing message. */
export function toFriendlyDeepSeekError(err: unknown): Error {
  if (err instanceof APIConnectionTimeoutError) {
    return new Error("DeepSeek took too long to respond — try again in a moment.");
  }
  if (err instanceof APIError) {
    if (err.status === 401) return new Error("DeepSeek rejected the API key — check DEEPSEEK_API_KEY.");
    if (err.status === 402) {
      return new Error("DeepSeek account balance is empty — top up at platform.deepseek.com.");
    }
    if (err.status === 429) return new Error("DeepSeek is rate-limiting requests right now — try again in a moment.");
    if (err.status && err.status >= 500) return new Error("DeepSeek is temporarily unavailable — try again in a moment.");
    return new Error(`DeepSeek error (${err.status}): ${err.message}`);
  }
  return err instanceof Error ? err : new Error("The AI request failed — try again.");
}

export type DeepSeekUsage = {
  inputTokens: number;
  /** Input tokens served from DeepSeek's automatic prefix cache — billed at ~1/30 of the normal input price. */
  cachedInputTokens: number;
  /** Includes reasoning tokens — DeepSeek bills them as output. */
  outputTokens: number;
  reasoningTokens: number;
};

/** Token usage of one completion, including DeepSeek's cache-hit count. */
export function readUsage(completion: OpenAI.ChatCompletion): DeepSeekUsage {
  const u = completion.usage as
    | (OpenAI.CompletionUsage & {
        prompt_cache_hit_tokens?: number;
        completion_tokens_details?: { reasoning_tokens?: number };
      })
    | undefined;
  return {
    inputTokens: u?.prompt_tokens ?? 0,
    cachedInputTokens: u?.prompt_cache_hit_tokens ?? u?.prompt_tokens_details?.cached_tokens ?? 0,
    outputTokens: u?.completion_tokens ?? 0,
    reasoningTokens: u?.completion_tokens_details?.reasoning_tokens ?? 0,
  };
}

/** Strips a stray ```json fence some models wrap around JSON-mode output. */
export function stripJsonFence(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
}

/**
 * The JSON object in a reply that may carry text around it (what a call made
 * without JSON mode can return): from the first "{" to the last "}". Returns
 * the trimmed input unchanged when there's no such span.
 */
export function extractJsonObject(raw: string): string {
  const text = stripJsonFence(raw);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start !== -1 && end > start ? text.slice(start, end + 1) : text;
}
