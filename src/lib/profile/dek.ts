import { db } from "@/lib/db";
import { unwrapDek } from "@/lib/crypto/envelope";

/** For Resume.tailoredContentEnc — independent of whichever profile is currently assigned. */
export async function getUserDek(userId: string): Promise<Buffer> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { encryptedDek: true },
  });
  return unwrapDek(user.encryptedDek);
}

/** For Profile/WorkHistoryEntry/EducationEntry/SkillGroup fields — belongs to the profile itself. */
export async function getProfileDek(profileId: string): Promise<Buffer> {
  const profile = await db.profile.findUniqueOrThrow({
    where: { id: profileId },
    select: { encryptedDek: true },
  });
  return unwrapDek(profile.encryptedDek);
}
