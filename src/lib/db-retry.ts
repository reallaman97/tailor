// Transient-failure handling for database calls. Pure (no db import) so it can
// be unit-tested and reused by db.ts and by callers that wrap a whole
// transaction.
//
// Two kinds of transient failure, with different retry rules:
//
// - "connect": the connection was never established (a slow/lossy network,
//   Neon waking a suspended compute, or waiting too long for a pool slot). The
//   query was never sent, so ANY operation — read or write — is safe to retry.
//
// - "in-flight": an open connection died while a query was running. The
//   server may or may not have executed it, so only operations that are safe
//   to run twice (reads, or an explicitly idempotent unit of work) are retried.

export type TransientKind = "connect" | "in-flight";

const CONNECT_MESSAGES = [
  /connection terminated due to connection timeout/i, // pg: new connection didn't finish in time
  /timeout exceeded when trying to connect/i, // pg-pool: no connection became available in time
  /can't reach database server/i,
];
const IN_FLIGHT_MESSAGES = [/connection terminated unexpectedly/i, /socket hang up/i, /connection (?:is )?closed/i];
const CONNECT_CODES = new Set(["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "P1001", "P1002", "P2024"]);
const IN_FLIGHT_CODES = new Set(["ECONNRESET", "EPIPE", "ETIMEDOUT", "P1017"]);
// Postgres SQLSTATEs for a connection the server closed or couldn't accept.
const PG_CONNECT_STATES = new Set(["57P03", "08001", "08004"]); // cannot connect now / rejected
const PG_IN_FLIGHT_STATES = new Set(["57P01", "57P02", "08000", "08003", "08006"]); // shutdown / connection lost

type ErrorLike = {
  message?: unknown;
  code?: unknown;
  cause?: unknown;
  meta?: { driverAdapterError?: { cause?: { originalCode?: unknown; code?: unknown } } };
};

/** Classifies an error from Prisma/pg as a transient connection failure, or null if it isn't one. */
export function transientKind(err: unknown): TransientKind | null {
  const e = (err ?? {}) as ErrorLike;
  const message = typeof e.message === "string" ? e.message : "";
  const code = typeof e.code === "string" ? e.code : "";
  const pgState = e.meta?.driverAdapterError?.cause?.originalCode ?? e.meta?.driverAdapterError?.cause?.code;

  // Checked first: a connect timeout's `cause` reads "terminated unexpectedly",
  // but the query was never sent.
  if (CONNECT_MESSAGES.some((p) => p.test(message)) || CONNECT_CODES.has(code)) return "connect";
  if (typeof pgState === "string" && PG_CONNECT_STATES.has(pgState)) return "connect";
  if (IN_FLIGHT_MESSAGES.some((p) => p.test(message)) || IN_FLIGHT_CODES.has(code)) return "in-flight";
  if (typeof pgState === "string" && PG_IN_FLIGHT_STATES.has(pgState)) return "in-flight";

  // Some layers wrap the original error; classify by what's underneath.
  if (e.cause && e.cause !== err) return transientKind(e.cause);
  return null;
}

/** Prisma operations that only read — safe to repeat after an in-flight failure. */
export const READ_OPERATIONS: ReadonlySet<string> = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

export type RetryOptions = {
  /** True if running the work twice is harmless (reads, or a replace-style unit of work). */
  idempotent: boolean;
  /** Retries after the first attempt. */
  retries?: number;
  /** Delay before each retry, in ms (the last value repeats). */
  backoffMs?: number[];
  /** Called before each retry — for logging. */
  onRetry?: (info: { attempt: number; kind: TransientKind; error: unknown }) => void;
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Runs `work`, retrying transient connection failures: connect-stage failures
 * always, in-flight failures only when `idempotent`. Any other error — or the
 * last failure once retries run out — is rethrown unchanged.
 */
export async function withDbRetry<T>(work: () => Promise<T>, options: RetryOptions): Promise<T> {
  const retries = options.retries ?? 2;
  const backoff = options.backoffMs ?? [300, 1000];
  const sleep = options.sleep ?? defaultSleep;

  for (let attempt = 0; ; attempt++) {
    try {
      return await work();
    } catch (error) {
      const kind = transientKind(error);
      const retryable = kind === "connect" || (kind === "in-flight" && options.idempotent);
      if (!retryable || attempt >= retries) throw error;
      options.onRetry?.({ attempt: attempt + 1, kind, error });
      await sleep(backoff[Math.min(attempt, backoff.length - 1)]);
    }
  }
}
