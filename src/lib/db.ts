import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  // Small per-instance pool: on serverless, many function instances run
  // concurrently (100+ users), and a large pool PER instance would quickly
  // exhaust Postgres/Neon's connection limit. Keep each instance's pool small
  // and let Neon's pooled endpoint (PgBouncer) fan connections out across
  // instances — point DATABASE_URL at the "-pooler" host in prod. Override the
  // per-instance cap with DB_POOL_MAX if needed.
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DB_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  return new PrismaClient({ adapter });
}

// Reuse one client (and its pool) per instance — across dev hot reloads and
// warm serverless invocations — so we don't open a fresh pool on every request.
export const db = globalThis.__prisma ?? createPrismaClient();
globalThis.__prisma = db;
