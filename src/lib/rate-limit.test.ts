import { describe, it, expect, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { consumeRateLimit, RateLimitExceededError } from "./rate-limit";

const WINDOW_MS = 60_000;

describe("rate limiting (integration)", () => {
  const testKeys: string[] = [];
  function testKey(): string {
    const key = `test:${randomUUID()}`;
    testKeys.push(key);
    return key;
  }

  afterAll(async () => {
    await db.rateLimitCounter.deleteMany({ where: { key: { in: testKeys } } });
  });

  it("allows requests up to the limit, then throws", async () => {
    const key = testKey();
    await expect(consumeRateLimit(key, 2, WINDOW_MS)).resolves.toBeUndefined();
    await expect(consumeRateLimit(key, 2, WINDOW_MS)).resolves.toBeUndefined();
    await expect(consumeRateLimit(key, 2, WINDOW_MS)).rejects.toThrow(RateLimitExceededError);
  });

  it("counts only within the current window — an earlier window doesn't block a new one", async () => {
    const key = testKey();
    // Seed a saturated counter in a window well in the past; the current
    // window's counter must start fresh, so this call is allowed.
    const pastWindow = new Date(Math.floor((Date.now() - 100 * WINDOW_MS) / WINDOW_MS) * WINDOW_MS);
    await db.rateLimitCounter.create({ data: { key, windowStart: pastWindow, count: 999 } });

    await expect(consumeRateLimit(key, 1, WINDOW_MS)).resolves.toBeUndefined();
  });

  it("keys are independent of each other", async () => {
    const keyA = testKey();
    const keyB = testKey();
    await consumeRateLimit(keyA, 1, WINDOW_MS);
    await expect(consumeRateLimit(keyA, 1, WINDOW_MS)).rejects.toThrow(RateLimitExceededError);
    await expect(consumeRateLimit(keyB, 1, WINDOW_MS)).resolves.toBeUndefined();
  });

  it("carries a custom message onto the thrown error", async () => {
    const key = testKey();
    await consumeRateLimit(key, 1, WINDOW_MS);
    await expect(consumeRateLimit(key, 1, WINDOW_MS, "nope")).rejects.toThrow("nope");
  });

  it("enforces the limit atomically under concurrency (no check-then-act race)", async () => {
    const key = testKey();
    const limit = 3;
    const attempts = 10;

    // Fire all attempts at once: with a bare count()+create() they'd all read a
    // below-limit count and slip through. The atomic upsert must let exactly
    // `limit` succeed and reject the rest.
    const results = await Promise.allSettled(
      Array.from({ length: attempts }, () => consumeRateLimit(key, limit, WINDOW_MS))
    );
    const allowed = results.filter((r) => r.status === "fulfilled").length;
    const rejected = results.filter((r) => r.status === "rejected").length;

    expect(allowed).toBe(limit);
    expect(rejected).toBe(attempts - limit);
  });
});
