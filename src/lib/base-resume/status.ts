import { db } from "@/lib/db";
import { unwrapDek } from "@/lib/crypto/envelope";
import { decryptField } from "@/lib/profile/crypto";

export type BaseResumeStatus = { importedAt: Date; fileName: string | null } | null;

/** Whether (and when) a profile's base resume was imported. Generation requires one. */
export async function getBaseResumeStatus(profileId: string): Promise<BaseResumeStatus> {
  const row = await db.profile.findUnique({
    where: { id: profileId },
    select: { baseResumeImportedAt: true, baseResumeFileName: true },
  });
  return row?.baseResumeImportedAt ? { importedAt: row.baseResumeImportedAt, fileName: row.baseResumeFileName } : null;
}

/** Bulk variant for list views — one query for all profiles. Missing ids map to null. */
export async function getBaseResumeStatuses(profileIds: string[]): Promise<Map<string, BaseResumeStatus>> {
  if (profileIds.length === 0) return new Map();
  const rows = await db.profile.findMany({
    where: { id: { in: profileIds } },
    select: { id: true, baseResumeImportedAt: true, baseResumeFileName: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return new Map(
    profileIds.map((id) => {
      const r = byId.get(id);
      return [id, r?.baseResumeImportedAt ? { importedAt: r.baseResumeImportedAt, fileName: r.baseResumeFileName } : null];
    })
  );
}

/** The stored base resume text (decrypted), or null if none was imported. Admin views only. */
export async function getBaseResumeText(profileId: string): Promise<string | null> {
  const row = await db.profile.findUnique({
    where: { id: profileId },
    select: { baseResumeTextEnc: true, encryptedDek: true },
  });
  if (!row?.baseResumeTextEnc) return null;
  return decryptField(unwrapDek(row.encryptedDek), row.baseResumeTextEnc);
}
