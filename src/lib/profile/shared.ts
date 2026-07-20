import { db } from "@/lib/db";

/** Returns the id of the profile currently assigned to this user, or null if none. */
export async function getAssignedProfileId(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { profileId: true } });
  return user?.profileId ?? null;
}
