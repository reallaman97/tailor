"use server";

import { db } from "@/lib/db";
import { generateResetToken, RESET_TOKEN_TTL_MS } from "@/lib/auth/reset-tokens";
import { sendPasswordResetEmail } from "@/lib/email/resend";
import { forgotPasswordSchema } from "@/lib/auth/schemas";
import { consumeRateLimit, RateLimitExceededError } from "@/lib/rate-limit";
import { getServerEnv } from "@/lib/env";

const RESET_REQUEST_RATE_LIMIT = 3;
const RESET_REQUEST_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export type ForgotPasswordState = { message?: string; error?: string } | undefined;

const GENERIC_MESSAGE = "If an account exists for that email, we've sent a reset link.";

export async function forgotPasswordAction(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { email } = parsed.data;

  // Rate-limited by email BEFORE the existence check, so the limit itself never
  // reveals whether the account exists — the same as the generic response it
  // can precede or follow. Atomic check-and-record closes the concurrency race.
  const rateLimitKey = `password-reset:${email}`;
  try {
    await consumeRateLimit(rateLimitKey, RESET_REQUEST_RATE_LIMIT, RESET_REQUEST_RATE_WINDOW_MS);
  } catch (err) {
    if (err instanceof RateLimitExceededError) return { error: err.message };
    throw err;
  }

  // Never reveal whether the account exists — same response either way.
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    return { message: GENERIC_MESSAGE };
  }

  const { raw, hash } = generateResetToken();
  await db.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  const { APP_URL } = getServerEnv();
  const resetUrl = `${APP_URL}/reset-password?token=${raw}`;

  await sendPasswordResetEmail(email, resetUrl);

  return { message: GENERIC_MESSAGE };
}
