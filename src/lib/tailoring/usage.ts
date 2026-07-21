import { db } from "@/lib/db";

// Micros (millionths of a dollar) per 1M tokens — i.e. $X becomes X_000_000.
// A single call often costs a fraction of a cent, so this unit is chosen to
// avoid rounding real costs down to zero. Unknown models record actual token
// counts but cost 0 rather than crashing generation over a pricing gap.
const MODEL_PRICING_MICROS_PER_MILLION_TOKENS: Record<
  string,
  { input: number; output: number }
> = {
  "gpt-4.1-mini": { input: 400_000, output: 1_600_000 },
  "gpt-4.1": { input: 2_000_000, output: 8_000_000 },
};

function estimateCostMicros(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING_MICROS_PER_MILLION_TOKENS[model];
  if (!pricing) return 0;
  const costMicros =
    (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
  return Math.round(costMicros);
}

export async function recordUsageEvent(params: {
  userId: string;
  resumeId?: string;
  kind: "tailoring";
  model: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  await db.usageEvent.create({
    data: {
      userId: params.userId,
      resumeId: params.resumeId,
      kind: params.kind,
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      estimatedCostMicros: estimateCostMicros(
        params.model,
        params.inputTokens,
        params.outputTokens
      ),
    },
  });
}
