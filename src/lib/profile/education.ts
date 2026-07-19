import { db } from "@/lib/db";
import { requireProfileId } from "@/lib/profile/shared";
import { toDateOnly, fromDateOnly } from "@/lib/profile/date-utils";
import type { EducationEntryInput } from "@/lib/profile/schemas";

export class EntryNotFoundError extends Error {
  constructor() {
    super("Education entry not found");
  }
}

export type EducationEntry = {
  id: string;
  institution: string;
  degree: string;
  field: string | null;
  startDate: string | null;
  endDate: string | null;
};

export async function listEducation(userId: string): Promise<EducationEntry[]> {
  const profile = await db.profile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) return [];

  const entries = await db.educationEntry.findMany({
    where: { profileId: profile.id },
    orderBy: { sortOrder: "asc" },
  });

  return entries.map((entry) => ({
    id: entry.id,
    institution: entry.institution,
    degree: entry.degree,
    field: entry.field,
    startDate: entry.startDate ? toDateOnly(entry.startDate) : null,
    endDate: entry.endDate ? toDateOnly(entry.endDate) : null,
  }));
}

export async function createEducationEntry(
  userId: string,
  input: EducationEntryInput
): Promise<string> {
  const profileId = await requireProfileId(userId);
  const count = await db.educationEntry.count({ where: { profileId } });

  const entry = await db.educationEntry.create({
    data: {
      profileId,
      institution: input.institution,
      degree: input.degree,
      field: input.field ?? null,
      startDate: input.startDate ? fromDateOnly(input.startDate) : null,
      endDate: input.endDate ? fromDateOnly(input.endDate) : null,
      sortOrder: count,
    },
  });

  return entry.id;
}

export async function updateEducationEntry(
  userId: string,
  entryId: string,
  input: EducationEntryInput
): Promise<void> {
  const result = await db.educationEntry.updateMany({
    where: { id: entryId, profile: { userId } },
    data: {
      institution: input.institution,
      degree: input.degree,
      field: input.field ?? null,
      startDate: input.startDate ? fromDateOnly(input.startDate) : null,
      endDate: input.endDate ? fromDateOnly(input.endDate) : null,
    },
  });

  if (result.count === 0) throw new EntryNotFoundError();
}

export async function deleteEducationEntry(userId: string, entryId: string): Promise<void> {
  const result = await db.educationEntry.deleteMany({
    where: { id: entryId, profile: { userId } },
  });

  if (result.count === 0) throw new EntryNotFoundError();
}
