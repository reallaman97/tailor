import { db } from "@/lib/db";
import { unwrapDek } from "@/lib/crypto/envelope";
import { decryptField } from "@/lib/profile/crypto";
import { createProfile as createProfileRecord } from "@/lib/profile/personal-info";
import type { PersonalInfoInput } from "@/lib/profile/schemas";

export type AdminProfileSummary = {
  id: string;
  fullName: string | null;
  assignedUsers: Array<{ id: string; email: string }>;
  createdAt: Date;
};

export async function listAllProfiles(teamId?: string): Promise<AdminProfileSummary[]> {
  const profiles = await db.profile.findMany({
    where: teamId ? { teamId } : {},
    orderBy: { createdAt: "asc" },
    include: { users: { select: { id: true, email: true }, orderBy: { email: "asc" } } },
  });

  // profiles already carry fullNameEnc/encryptedDek from the fetch above —
  // decrypting in place avoids an N+1 getPersonalInfo query per profile.
  return profiles.map((profile) => ({
    id: profile.id,
    fullName: decryptField(unwrapDek(profile.encryptedDek), profile.fullNameEnc),
    assignedUsers: profile.users,
    createdAt: profile.createdAt,
  }));
}

export async function createProfile(input: PersonalInfoInput, teamId?: string | null): Promise<string> {
  return createProfileRecord(input, teamId);
}

export async function deleteProfile(profileId: string): Promise<void> {
  await db.profile.delete({ where: { id: profileId } });
}

/** Assigns an existing pool profile to a user account — a profile may be assigned to any number of accounts. */
export async function assignProfileToUser(profileId: string, userId: string): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { profileId } });
}

/** Removes this user's assignment to whichever profile they currently have (if any). */
export async function unassignUser(userId: string): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { profileId: null } });
}
