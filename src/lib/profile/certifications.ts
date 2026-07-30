import { db } from "@/lib/db";
import { toDateOnly, fromDateOnly } from "@/lib/profile/date-utils";
import type { CertificationEntryInput } from "@/lib/profile/schemas";

export class CertificationNotFoundError extends Error {
  constructor() {
    super("Certification not found");
  }
}

export type CertificationEntry = {
  id: string;
  name: string;
  issuer: string | null;
  issueDate: string | null;
};

export async function listCertifications(profileId: string): Promise<CertificationEntry[]> {
  const entries = await db.certificationEntry.findMany({
    where: { profileId },
    orderBy: { sortOrder: "asc" },
  });

  return entries.map((entry) => ({
    id: entry.id,
    name: entry.name,
    issuer: entry.issuer,
    issueDate: entry.issueDate ? toDateOnly(entry.issueDate) : null,
  }));
}

export async function createCertificationEntry(
  profileId: string,
  input: CertificationEntryInput
): Promise<string> {
  const count = await db.certificationEntry.count({ where: { profileId } });

  const entry = await db.certificationEntry.create({
    data: {
      profileId,
      name: input.name,
      issuer: input.issuer ?? null,
      issueDate: input.issueDate ? fromDateOnly(input.issueDate) : null,
      sortOrder: count,
    },
  });

  return entry.id;
}

export async function updateCertificationEntry(
  profileId: string,
  entryId: string,
  input: CertificationEntryInput
): Promise<void> {
  const result = await db.certificationEntry.updateMany({
    where: { id: entryId, profileId },
    data: {
      name: input.name,
      issuer: input.issuer ?? null,
      issueDate: input.issueDate ? fromDateOnly(input.issueDate) : null,
    },
  });

  if (result.count === 0) throw new CertificationNotFoundError();
}

export async function deleteCertificationEntry(profileId: string, entryId: string): Promise<void> {
  const result = await db.certificationEntry.deleteMany({
    where: { id: entryId, profileId },
  });

  if (result.count === 0) throw new CertificationNotFoundError();
}
