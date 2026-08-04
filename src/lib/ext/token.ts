import { createHmac, timingSafeEqual } from "crypto";

/**
 * Stateless bearer tokens for the browser extension.
 *
 * A Chrome extension is a different origin (chrome-extension://…), so its
 * requests to the site are cross-site and the browser will NOT attach the
 * SameSite=Lax session cookie — cookie reuse can't work. Instead the extension
 * logs in via /api/ext/login and gets one of these tokens, which it sends as
 * `Authorization: Bearer <token>` on every request (see getExtUser).
 *
 * The token is `<payload>.<hmac>` where payload is base64url({ uid, exp }) and
 * hmac is HMAC-SHA256(payload) keyed by AUTH_SECRET — so it's verifiable
 * without a DB lookup and can't be forged without the server secret. Rotating
 * AUTH_SECRET (or its natural 30-day expiry) invalidates outstanding tokens.
 */

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not set");
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createExtToken(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + TOKEN_TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Returns the userId if the token is valid and unexpired, else null. */
export function verifyExtToken(token: string): string | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);

  const expectedSig = sign(payload);
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.uid !== "string" || typeof data.exp !== "number") return null;
    if (Date.now() > data.exp) return null;
    return data.uid;
  } catch {
    return null;
  }
}
