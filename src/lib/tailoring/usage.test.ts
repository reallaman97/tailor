import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createTestUser, deleteTestUser } from "@/lib/profile/test-helpers";
import { recordUsageEvent, assertUnderDailyLimit, RateLimitExceededError } from "./usage";

describe("usage tracking and rate limiting (integration)", () => {
  let userId: string;

  beforeAll(async () => {
    ({ id: userId } = await createTestUser());
  });

  afterAll(async () => {
    await deleteTestUser(userId);
  });

  it("allows generation when under the limit", async () => {
    await expect(assertUnderDailyLimit(userId, "tailoring", 5)).resolves.toBeUndefined();
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

  it("throws once the daily limit is reached, scoped per kind", async () => {
    const freshUser = await createTestUser();
    try {
      for (let i = 0; i < 3; i++) {
        await recordUsageEvent({
          userId: freshUser.id,
          kind: "tailoring",
          model: "gpt-4.1-mini",
          inputTokens: 100,
          outputTokens: 50,
        });
      }

      await expect(assertUnderDailyLimit(freshUser.id, "tailoring", 3)).rejects.toThrow(
        RateLimitExceededError
      );

      // A different kind has its own independent count.
      await expect(
        assertUnderDailyLimit(freshUser.id, "resume_import", 3)
      ).resolves.toBeUndefined();
    } finally {
      await deleteTestUser(freshUser.id);
    }
  });
});
