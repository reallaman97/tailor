import { db } from "@/lib/db";

/**
 * Permanently deletes the user and everything owned by their account
 * (Resume, PasswordResetToken) via the schema's ON DELETE CASCADE. Their
 * assigned Profile, if any, is untouched — Profile has no dependency on
 * User, so it (and any other accounts sharing it) is unaffected.
 */
export async function deleteAccount(userId: string): Promise<void> {
  await db.user.delete({ where: { id: userId } });
}
