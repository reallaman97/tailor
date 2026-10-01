import { db } from "@/lib/db";

// Micros (millionths of a dollar) per 1M tokens — i.e. $X becomes X_000_000.
// A single call often costs a fraction of a cent, so this unit is chosen to
// avoid rounding real costs down to zero. Unknown models record actual token
// counts but cost 0 rather than crashing generation over a pricing gap.
const MODEL_PRICING_MICROS_PER_MILLION_TOKENS: Record<string, { input: number; cachedInput: number; output: number }> = {
  "gpt-4.1-mini": { input: 400_000, cachedInput: 100_000, output: 1_600_000 },
  "gpt-4.1": { input: 2_000_000, cachedInput: 500_000, output: 8_000_000 },
  // DeepSeek, at peak rates — off-peak is half, so this estimate errs high.
  // `cachedInput` is the prefix-cache-hit price; output includes the reasoning
  // tokens DeepSeek bills for.
  "deepseek-v4-pro": { input: 1_320_000, cachedInput: 44_000, output: 3_960_000 },
  "deepseek-flash": { input: 300_000, cachedInput: 6_000, output: 1_200_000 },
};

/** Estimated cost in micro-dollars; cached input tokens are a subset of `inputTokens`. */
export function estimateCostMicros(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens = 0
): number {
  const pricing = MODEL_PRICING_MICROS_PER_MILLION_TOKENS[model];
  if (!pricing) return 0;
  const cached = Math.min(cachedInputTokens, inputTokens);
  const costMicros =
    ((inputTokens - cached) / 1_000_000) * pricing.input +
    (cached / 1_000_000) * pricing.cachedInput +
    (outputTokens / 1_000_000) * pricing.output;
  return Math.round(costMicros);
}

export async function recordUsageEvent(params: {
  userId: string;
  resumeId?: string;
  kind: "tailoring" | "resume-import" | "cover-letter" | "ask-ai";
  model: string;
  inputTokens: number;
  /** Of `inputTokens`, how many were served from the provider's prompt cache. */
  cachedInputTokens?: number;
  outputTokens: number;
}): Promise<void> {
  const cachedInputTokens = params.cachedInputTokens ?? 0;
  await db.usageEvent.create({
    data: {
      userId: params.userId,
      resumeId: params.resumeId,
      kind: params.kind,
      model: params.model,
      inputTokens: params.inputTokens,
      cachedInputTokens,
      outputTokens: params.outputTokens,
      estimatedCostMicros: estimateCostMicros(params.model, params.inputTokens, params.outputTokens, cachedInputTokens),
    },
  });
}
