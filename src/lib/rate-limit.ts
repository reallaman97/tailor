import { db } from "@/lib/db";

export class RateLimitExceededError extends Error {
  constructor(message = "Too many attempts. Try again later.") {
    super(message);
  }
}

/**
 * Atomically enforce a fixed-window limit for `key`: allow at most `limit`
 * calls per `windowMs`-wide time bucket, throwing RateLimitExceededError once
 * that's exceeded.
 *
 * Implemented as a single `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`
 * against a per-(key, window) counter row. That statement is atomic — Postgres
 * row-locks the counter for the duration of the upsert, so concurrent callers
 * for the same key serialise on it and each receives a distinct incremented
 * value. This closes the check-then-act race a separate count()+create() has,
 * without holding an interactive transaction / DB connection open while blocked
 * (which under a burst — the very thing rate limiting defends against — could
 * exhaust the connection pool).
 *
 * Fixed windows can admit up to ~2×`limit` across a window boundary; that's the
 * accepted trade for a lock-free, single-round-trip limiter.
 */
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  message?: string
): Promise<void> {
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);

  const rows = await db.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "RateLimitCounter" ("key", "windowStart", "count")
    VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT ("key", "windowStart")
    DO UPDATE SET "count" = "RateLimitCounter"."count" + 1
    RETURNING "count"
  `;

  const count = rows[0]?.count ?? 0;
  if (count > limit) throw new RateLimitExceededError(message);
}
