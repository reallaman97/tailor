import { PrismaClient, Prisma } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { withDbRetry, READ_OPERATIONS } from "@/lib/db-retry";

/**
 * Retries transient connection failures on every query (see db-retry.ts): a
 * connection that couldn't be opened — a lossy network, or Neon waking a
 * suspended compute — is retried for any operation, since nothing was sent;
 * a connection that died mid-query is retried only for reads, since a write
 * may already have been applied.
 *
 * Statements inside a transaction are never retried individually — the
 * transaction's connection is the unit that failed, so the whole transaction
 * is what gets retried, at its call site (wrapped in withDbRetry).
 */
export const transientRetry = Prisma.defineExtension({
  name: "transient-retry",
  query: {
    async $allOperations(params) {
      const { model, operation, args, query } = params;
      // Not in Prisma's public types, but set for both batch ([...]) and
      // interactive (callback) transactions — verified against Prisma 7.8.
      const inTransaction = Boolean(
        (params as { __internalParams?: { transaction?: unknown } }).__internalParams?.transaction
      );
      if (inTransaction) return query(args);

      return withDbRetry(() => query(args), {
        idempotent: READ_OPERATIONS.has(operation),
        onRetry: ({ attempt, kind, error }) =>
          console.warn(
            `[db] retrying ${model ? `${model}.` : ""}${operation} (attempt ${attempt + 1}, ${kind} failure): ${
              error instanceof Error ? error.message : String(error)
            }`
          ),
      });
    },
  },
});

function createPrismaClient() {
  // Small per-instance pool: on serverless, many function instances run
  // concurrently (100+ users), and a large pool PER instance would quickly
  // exhaust Postgres/Neon's connection limit. Keep each instance's pool small
  // and let Neon's pooled endpoint (PgBouncer) fan connections out across
  // instances — point DATABASE_URL at the "-pooler" host in prod. Override the
  // per-instance cap with DB_POOL_MAX if needed.
  //
  // Timeouts are sized for a high-latency link to the database, where opening
  // a TLS connection costs ~2s: idle connections are kept for a minute so
  // consecutive requests reuse them instead of reconnecting, and a request may
  // wait up to 20s for a connection (that wait includes queueing for a free
  // pool slot while a page runs several queries at once). TCP keep-alive stops
  // idle sockets from being silently dropped by intermediate network hops.
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DB_POOL_MAX ?? 5),
    idleTimeoutMillis: 60_000,
    connectionTimeoutMillis: 20_000,
    keepAlive: true,
  });
  return new PrismaClient({ adapter }).$extends(transientRetry);
}

type Db = ReturnType<typeof createPrismaClient>;

declare global {
  var __prisma: Db | undefined;
}

// Reuse one client (and its pool) per instance — across dev hot reloads and
// warm serverless invocations — so we don't open a fresh pool on every request.
export const db = globalThis.__prisma ?? createPrismaClient();
globalThis.__prisma = db;
