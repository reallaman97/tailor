import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createTestUser, deleteTestUser } from "@/lib/profile/test-helpers";
import { recordUsageEvent, estimateCostMicros } from "./usage";

// UsageEvent here is purely cost/token accounting.
describe("usage tracking (integration)", () => {
  let userId: string;

  beforeAll(async () => {
    ({ id: userId } = await createTestUser());
  });

  afterAll(async () => {
    await deleteTestUser(userId);
  });

  it("records a usage event with a non-zero cost for realistic token counts", async () => {
    await recordUsageEvent({
      userId,
      kind: "tailoring",
      model: "gpt-4.1-mini",
      inputTokens: 2000,
      outputTokens: 600,
    });

    const event = await db.usageEvent.findFirstOrThrow({
      where: { userId, kind: "tailoring" },
      orderBy: { createdAt: "desc" },
    });
    expect(event.inputTokens).toBe(2000);
    expect(event.outputTokens).toBe(600);
    // 2000/1e6*400_000 + 600/1e6*1_600_000 = 800 + 960 = 1760 micros ($0.00176)
    expect(event.estimatedCostMicros).toBe(1760);
  });

  it("records zero cost (but keeps real token counts) for an unrecognized model", async () => {
    await recordUsageEvent({
      userId,
      kind: "tailoring",
      model: "some-future-model",
      inputTokens: 1000,
      outputTokens: 500,
    });

    const event = await db.usageEvent.findFirstOrThrow({
      where: { userId, model: "some-future-model" },
    });
    expect(event.inputTokens).toBe(1000);
    expect(event.estimatedCostMicros).toBe(0);
  });
});

describe("estimateCostMicros (prompt-cache pricing)", () => {
  it("bills cache-hit input tokens at the cache price", () => {
    // deepseek-v4-pro: $1.32/M input, $0.044/M cached input, $3.96/M output.
    const uncached = estimateCostMicros("deepseek-v4-pro", 1_000_000, 0);
    const mostlyCached = estimateCostMicros("deepseek-v4-pro", 1_000_000, 0, 900_000);
    expect(uncached).toBe(1_320_000);
    expect(mostlyCached).toBe(Math.round(100_000 * 1.32 + 900_000 * 0.044));
  });

  it("never counts more cached tokens than input tokens, and prices unknown models at 0", () => {
    expect(estimateCostMicros("deepseek-flash", 100, 0, 500)).toBe(estimateCostMicros("deepseek-flash", 100, 0, 100));
    expect(estimateCostMicros("some-new-model", 1_000_000, 1_000_000)).toBe(0);
  });
});
