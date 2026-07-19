import { describe, it, expect, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { assertUnderRateLimit, recordRateLimitHit, RateLimitExceededError } from "./rate-limit";

describe("rate limiting (integration)", () => {
  const testKeys: string[] = [];
  function testKey(): string {
    const key = `test:${randomUUID()}`;
    testKeys.push(key);
    return key;
  }

  afterAll(async () => {
    await db.rateLimitHit.deleteMany({ where: { key: { in: testKeys } } });
  });

  it("allows requests under the limit", async () => {
    const key = testKey();
    await expect(assertUnderRateLimit(key, 3, 60_000)).resolves.toBeUndefined();
  });

  it("throws once recorded hits reach the limit within the window", async () => {
    const key = testKey();
    await recordRateLimitHit(key);
    await recordRateLimitHit(key);
    await expect(assertUnderRateLimit(key, 2, 60_000)).rejects.toThrow(RateLimitExceededError);
  });

  it("does not count hits outside the window", async () => {
    const key = testKey();
    // Simulate an old hit by using a window of 0ms — nothing should count as "recent".
    await recordRateLimitHit(key);
    await expect(assertUnderRateLimit(key, 1, 0)).resolves.toBeUndefined();
  });

  it("keys are independent of each other", async () => {
    const keyA = testKey();
    const keyB = testKey();
    await recordRateLimitHit(keyA);
    await recordRateLimitHit(keyA);
    await expect(assertUnderRateLimit(keyA, 2, 60_000)).rejects.toThrow(RateLimitExceededError);
    await expect(assertUnderRateLimit(keyB, 2, 60_000)).resolves.toBeUndefined();
  });
});
