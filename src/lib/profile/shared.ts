import { db } from "@/lib/db";

export class ProfileNotFoundError extends Error {
  constructor() {
    super("Save your personal info before adding this section");
  }
}

/** Returns the current user's Profile id, or null if they haven't saved personal info yet. */
export async function getProfileId(userId: string): Promise<string | null> {
  const profile = await db.profile.findUnique({ where: { userId }, select: { id: true } });
  return profile?.id ?? null;
}

export async function requireProfileId(userId: string): Promise<string> {
  const id = await getProfileId(userId);
  if (!id) throw new ProfileNotFoundError();
  return id;
}
