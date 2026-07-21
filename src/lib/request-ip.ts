import { headers } from "next/headers";

/**
 * Extract a spoofing-resistant client IP from a request's headers.
 *
 * `x-forwarded-for` is a chain "client, proxy1, proxy2, …": the LEFTMOST entry
 * is fully attacker-controlled (any client can send an `x-forwarded-for`
 * header of its choosing) and every proxy in the path appends the peer it
 * actually received the connection from. Our deploy target (Vercel) places
 * exactly one trusted proxy in front of the app, so the entry that proxy
 * appended — the RIGHTMOST — is the real client IP. Vercel also surfaces it
 * directly as `x-real-ip`, which we prefer.
 *
 * The previous implementation read the leftmost hop, which let anyone bypass a
 * per-IP limit by rotating a forged header; we never trust that value.
 */
export function clientIpFromHeaders(headerList: Headers): string {
  const realIp = headerList.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) {
    const hops = forwardedFor
      .split(",")
      .map((hop) => hop.trim())
      .filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }

  return "unknown";
}

/**
 * Best-effort client IP for rate limiting from within a Server Action or Route
 * Handler. In local dev without a proxy it falls back to a fixed bucket, which
 * is fine since dev traffic comes from a single machine anyway.
 */
export async function getClientIp(): Promise<string> {
  return clientIpFromHeaders(await headers());
}
