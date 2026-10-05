import { db } from "@/lib/db";

// Keeps the database inside Neon's free-plan storage (1GB) at thousands of
// applications a month by clearing the bulky parts of old applications. The
// application itself — company, title, dates, statuses, who applied, whether
// proof was given and approved — is never deleted, so the tracker and the
// dashboard stats stay complete.
//
// Plain SQL on purpose: Prisma's updateMany would bump updatedAt, which drives
// the follow-up reminders — and clearing old data isn't activity.

/** An approved proof screenshot is kept this long after approval, then its image is deleted. */
export const PROOF_RETENTION_DAYS = 30;
/**
 * Backstop for proof that's never reviewed (most of it, in practice): any
 * screenshot image is deleted once its application is this old.
 */
export const PROOF_MAX_AGE_DAYS = 60;
/**
 * The generated text (tailored resume, cover letter, answers) and the job
 * description are kept this long — unless the application got a response
 * (reply, interview, offer), when they're needed again and kept for good.
 */
export const CONTENT_RETENTION_DAYS = 90;

export type RetentionResult = { proofsCleared: number; contentCleared: number };

export async function applyRetention(now: Date = new Date()): Promise<RetentionResult> {
  const proofCutoff = new Date(now.getTime() - PROOF_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const proofMaxAgeCutoff = new Date(now.getTime() - PROOF_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
  const contentCutoff = new Date(now.getTime() - CONTENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  // screenshotMimeType stays set: it records that proof WAS provided (the
  // dashboard counts it); only the image is deleted.
  const proofsCleared = await db.$executeRaw`
    UPDATE "Resume" SET "screenshotData" = NULL
    WHERE "screenshotData" IS NOT NULL
      AND (("approvalStatus" = 'APPROVED' AND "approvedAt" < ${proofCutoff}) OR "createdAt" < ${proofMaxAgeCutoff})`;

  const contentCleared = await db.$transaction(async (tx) => {
    const stale = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Resume"
      WHERE "createdAt" < ${contentCutoff}
        AND NOT ("statuses" && ARRAY['REPLY','INTRO','TECH1','TECH2','FINAL','OFFER']::"ResumeStatus"[])
        AND ("tailoredContentEnc" IS NOT NULL OR "coverLetterEnc" IS NOT NULL OR "jobDescription" <> '')
      LIMIT 5000`;
    const ids = stale.map((r) => r.id);
    if (ids.length === 0) return 0;
    await tx.applicationAnswer.deleteMany({ where: { resumeId: { in: ids } } });
    await tx.$executeRaw`
      UPDATE "Resume"
      SET "tailoredContentEnc" = NULL, "coverLetterEnc" = NULL, "coverLetterGeneratedAt" = NULL, "jobDescription" = ''
      WHERE id = ANY(${ids})`;
    return ids.length;
  });

  return { proofsCleared, contentCleared };
}
