import { getServerEnv } from "@/lib/env";

/**
 * Runs once when a server instance starts, before it handles any request.
 * We use it to fail fast on a bad environment configuration: a missing or
 * malformed secret becomes a single, clear boot-time error instead of an
 * opaque runtime 500 the first time some request happens to read that value.
 *
 * Only validated on the Node runtime — the Edge runtime doesn't touch the
 * secrets (DB/crypto/OpenAI) this validates.
 */
export function register(): void {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    getServerEnv();
  }
}
