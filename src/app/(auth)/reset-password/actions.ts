"use server";

import { db } from "@/lib/db";
import { withDbRetry } from "@/lib/db-retry";
import { hashPassword } from "@/lib/auth/password";
import { hashResetToken } from "@/lib/auth/reset-tokens";
import { resetPasswordSchema } from "@/lib/auth/schemas";

export type ResetPasswordState = { error?: string; success?: boolean } | undefined;

export async function resetPasswordAction(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { token, password } = parsed.data;
  const tokenHash = hashResetToken(token);

  const resetToken = await db.passwordResetToken.findUnique({ where: { tokenHash } });

  if (
    !resetToken ||
    resetToken.usedAt !== null ||
    resetToken.expiresAt.getTime() < Date.now()
  ) {
    return { error: "This reset link is invalid or has expired" };
  }

  const passwordHash = await hashPassword(password);

  // Every write sets a value, so repeating the batch after a transient failure is harmless.
  await withDbRetry(
    () =>
      db.$transaction([
        db.user.update({
          where: { id: resetToken.userId },
          data: { passwordHash },
        }),
        db.passwordResetToken.update({
          where: { id: resetToken.id },
          data: { usedAt: new Date() },
        }),
        // Invalidate any other outstanding reset tokens for this user.
        db.passwordResetToken.updateMany({
          where: { userId: resetToken.userId, usedAt: null, id: { not: resetToken.id } },
          data: { usedAt: new Date() },
        }),
      ]),
    { idempotent: true }
  );

  return { success: true };
}
