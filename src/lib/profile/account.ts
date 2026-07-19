import { db } from "@/lib/db";

/**
 * Permanently deletes the user and everything derived from them (Profile,
 * WorkHistoryEntry, EducationEntry, SkillGroup, Resume, PasswordResetToken)
 * via the schema's ON DELETE CASCADE.
 */
export async function deleteAccount(userId: string): Promise<void> {
  await db.user.delete({ where: { id: userId } });
}
