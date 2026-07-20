import { db } from "@/lib/db";
import { getProfileDek } from "@/lib/profile/dek";
import { encryptJson, decryptJson } from "@/lib/profile/crypto";
import { toDateOnly, fromDateOnly } from "@/lib/profile/date-utils";
import type { WorkHistoryEntryInput } from "@/lib/profile/schemas";

export class EntryNotFoundError extends Error {
  constructor() {
    super("Work history entry not found");
  }
}

export type DecryptedWorkHistoryEntry = {
  id: string;
  company: string;
  jobTitle: string;
  location: string | null;
  startDate: string;
  endDate: string | null; // null = current role
  achievements: string[];
};

export async function listWorkHistory(profileId: string): Promise<DecryptedWorkHistoryEntry[]> {
  const entries = await db.workHistoryEntry.findMany({
    where: { profileId },
    orderBy: { sortOrder: "asc" },
  });
  if (entries.length === 0) return [];

  const dek = await getProfileDek(profileId);
  return entries.map((entry) => ({
    id: entry.id,
    company: entry.company,
    jobTitle: entry.jobTitle,
    location: entry.location,
    startDate: toDateOnly(entry.startDate),
    endDate: entry.endDate ? toDateOnly(entry.endDate) : null,
    achievements: decryptJson<string[]>(dek, entry.achievementsEnc),
  }));
}

export async function createWorkHistoryEntry(
  profileId: string,
  input: WorkHistoryEntryInput
): Promise<string> {
  const dek = await getProfileDek(profileId);
  const count = await db.workHistoryEntry.count({ where: { profileId } });

  const entry = await db.workHistoryEntry.create({
    data: {
      profileId,
      company: input.company,
      jobTitle: input.jobTitle,
      location: input.location ?? null,
      startDate: fromDateOnly(input.startDate),
      endDate: input.endDate ? fromDateOnly(input.endDate) : null,
      achievementsEnc: encryptJson(dek, input.achievements),
      sortOrder: count,
    },
  });

  return entry.id;
}

export async function updateWorkHistoryEntry(
  profileId: string,
  entryId: string,
  input: WorkHistoryEntryInput
): Promise<void> {
  const dek = await getProfileDek(profileId);

  const result = await db.workHistoryEntry.updateMany({
    where: { id: entryId, profileId },
    data: {
      company: input.company,
      jobTitle: input.jobTitle,
      location: input.location ?? null,
      startDate: fromDateOnly(input.startDate),
      endDate: input.endDate ? fromDateOnly(input.endDate) : null,
      achievementsEnc: encryptJson(dek, input.achievements),
    },
  });

  if (result.count === 0) throw new EntryNotFoundError();
}

export async function deleteWorkHistoryEntry(profileId: string, entryId: string): Promise<void> {
  const result = await db.workHistoryEntry.deleteMany({
    where: { id: entryId, profileId },
  });

  if (result.count === 0) throw new EntryNotFoundError();
}
