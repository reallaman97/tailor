import { headers } from "next/headers";

/**
 * Best-effort client IP for rate limiting. Vercel (our deploy target) sets
 * x-forwarded-for reliably; in local dev without a proxy it falls back to a
 * fixed bucket, which is fine since dev traffic is a single machine anyway.
 */
export async function getClientIp(): Promise<string> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return "unknown";
}
