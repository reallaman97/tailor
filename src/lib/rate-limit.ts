import { db } from "@/lib/db";

export class RateLimitExceededError extends Error {
  constructor() {
    super("Too many attempts. Try again later.");
  }
}

/** Throws if `key` has hit `limit` or more recorded hits within the trailing `windowMs`. */
export async function assertUnderRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<void> {
  const count = await db.rateLimitHit.count({
    where: { key, createdAt: { gte: new Date(Date.now() - windowMs) } },
  });
  if (count >= limit) throw new RateLimitExceededError();
}

/** Records one hit against `key`. Callers decide when a hit counts (e.g. only failed logins). */
export async function recordRateLimitHit(key: string): Promise<void> {
  await db.rateLimitHit.create({ data: { key } });
}
