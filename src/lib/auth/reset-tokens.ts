import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

const TOKEN_BYTES = 32;
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Generates a fresh reset token. Only `hash` is ever stored; `raw` goes in the emailed link. */
export function generateResetToken(): { raw: string; hash: string } {
  const raw = randomBytes(TOKEN_BYTES).toString("base64url");
  return { raw, hash: hashResetToken(raw) };
}

export function hashResetToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

/** Constant-time comparison against a stored hash, to avoid timing side-channels. */
export function resetTokenMatches(raw: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashResetToken(raw), "hex");
  const stored = Buffer.from(storedHash, "hex");
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}
