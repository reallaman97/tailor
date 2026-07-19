"use server";

import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { generateDek, wrapDek } from "@/lib/crypto/envelope";
import { signupSchema } from "@/lib/auth/schemas";
import { signIn } from "@/auth";
import { assertUnderRateLimit, recordRateLimitHit, RateLimitExceededError } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

const SIGNUP_RATE_LIMIT = 5;
const SIGNUP_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export type SignupState = { error?: string } | undefined;

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
    await assertUnderRateLimit(`signup:${ip}`, SIGNUP_RATE_LIMIT, SIGNUP_RATE_WINDOW_MS);
  } catch (err) {
    if (err instanceof RateLimitExceededError) return { error: err.message };
    throw err;
  }
  await recordRateLimitHit(`signup:${ip}`);

  const { email, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists" };
  }

  const passwordHash = await hashPassword(password);
  const dek = generateDek();
  const encryptedDek = wrapDek(dek);

  await db.user.create({
    data: { email, passwordHash, encryptedDek },
  });

  await signIn("credentials", { email, password, redirectTo: "/dashboard" });
}
