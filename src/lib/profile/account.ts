import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

export class UsernameTakenError extends Error {
  constructor() {
    super("That username is taken");
  }
}

export class IncorrectPasswordError extends Error {
  constructor() {
    super("Your current password is incorrect");
  }
}

/** Changes a user's public handle. Throws UsernameTakenError if another account already uses it. */
export async function updateUsername(userId: string, username: string): Promise<void> {
  const existing = await db.user.findUnique({ where: { username }, select: { id: true } });
  if (existing && existing.id !== userId) throw new UsernameTakenError();

  try {
    await db.user.update({ where: { id: userId }, data: { username } });
  } catch (err) {
    // Lost a race between the check above and the update.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new UsernameTakenError();
    }
    throw err;
  }
}

/** Changes a user's password after verifying their current one. */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
  if (!(await verifyPassword(user.passwordHash, currentPassword))) {
    throw new IncorrectPasswordError();
  }
  const passwordHash = await hashPassword(newPassword);
  await db.user.update({ where: { id: userId }, data: { passwordHash } });
}

/**
 * Permanently deletes the user and everything owned by their account
 * (Resume, PasswordResetToken) via the schema's ON DELETE CASCADE. Their
 * assigned Profile, if any, is untouched — Profile has no dependency on
 * User, so it (and any other accounts sharing it) is unaffected.
 */
export async function deleteAccount(userId: string): Promise<void> {
  await db.user.delete({ where: { id: userId } });
}
