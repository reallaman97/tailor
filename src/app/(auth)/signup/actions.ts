"use server";

import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { generateDek, wrapDek } from "@/lib/crypto/envelope";
import { signupSchema } from "@/lib/auth/schemas";
import { consumeRateLimit, RateLimitExceededError } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

const SIGNUP_RATE_LIMIT = 5;
const SIGNUP_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export type SignupState = { error?: string; pending?: boolean } | undefined;

export async function signupAction(_prevState: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ip = await getClientIp();
  try {
    await consumeRateLimit(`signup:${ip}`, SIGNUP_RATE_LIMIT, SIGNUP_RATE_WINDOW_MS);
  } catch (err) {
    if (err instanceof RateLimitExceededError) return { error: err.message };
    throw err;
  }

  const { email, password } = parsed.data;

  // Hash before the existence check so the two branches do the same expensive
  // work — response timing must not reveal whether the email already exists.
  const passwordHash = await hashPassword(password);

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (!existing) {
    const dek = generateDek();
    const encryptedDek = wrapDek(dek);
    // approved defaults to false — a superadmin must approve the account
    // before it can log in, so we don't auto sign-in here.
    await db.user.create({ data: { email, passwordHash, encryptedDek } });
  }

  // Always the same response whether or not the email was already registered —
  // never disclose account existence (mirrors the generic forgot-password flow).
  // Someone re-registering an existing address can recover it via password reset.
  return { pending: true };
}
