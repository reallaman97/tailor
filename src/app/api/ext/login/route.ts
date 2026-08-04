import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createExtToken } from "@/lib/ext/token";
import { TOOLS, canAccessTool } from "@/lib/tools";
import { consumeRateLimit, RateLimitExceededError } from "@/lib/rate-limit";
import { clientIpFromHeaders } from "@/lib/request-ip";

const LOGIN_RATE_LIMIT = 20;
const LOGIN_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_PASSWORD_LENGTH = 128;

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(MAX_PASSWORD_LENGTH),
});

// A generic 401 for every credential failure — never reveal whether the email
// exists, the password was wrong, or the attempt was rate-limited.
const INVALID = NextResponse.json({ error: "Invalid email or password." }, { status: 401 });

/**
 * Extension login. Verifies credentials directly (the extension can't use the
 * cookie-based Auth.js flow — see @/lib/ext/token) and returns a bearer token
 * the extension sends on every request. Rate-limited per IP, mirroring the web
 * login guard.
 */
export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return INVALID;
  }

  const ip = clientIpFromHeaders(request.headers);
  try {
    await consumeRateLimit(`ext-login:ip:${ip}`, LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW_MS);
  } catch (err) {
    if (err instanceof RateLimitExceededError) return INVALID; // ambiguous with wrong-password, by design
    throw err;
  }

  const user = await db.user.findUnique({ where: { email: body.email.toLowerCase() } });
  if (!user) return INVALID;

  const valid = await verifyPassword(user.passwordHash, body.password);
  if (!valid) return INVALID;

  if (!user.approved) {
    return NextResponse.json({ error: "Your account is pending approval." }, { status: 403 });
  }

  const resumePlatform = TOOLS.find((tool) => tool.key === "resume-platform")!;
  if (!canAccessTool(user.role, resumePlatform)) {
    return NextResponse.json({ error: "This account can't use the Resume Platform." }, { status: 403 });
  }

  const token = createExtToken(user.id);
  return NextResponse.json({ token, user: { email: user.email, role: user.role } });
}
