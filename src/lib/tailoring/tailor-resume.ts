import { db } from "@/lib/db";
import { getResume, ResumeNotFoundError } from "@/lib/resumes/resumes";
import { getResumeFields } from "@/lib/profile/resume-fields";
import { getUserDek } from "@/lib/profile/dek";
import { encryptJson, decryptJson } from "@/lib/profile/crypto";
import { generateTailoredContent, TAILORING_PROMPT_VERSION } from "@/lib/tailoring/generate";
import { assertUnderDailyLimit, recordUsageEvent } from "@/lib/tailoring/usage";
import type { TailoredContent } from "@/lib/tailoring/schema";

export class ProfileIncompleteError extends Error {
  constructor() {
    super("Save your personal info before generating a tailored resume");
  }
}

function getDailyLimit(): number {
  return Number(process.env.TAILORING_DAILY_LIMIT ?? "20");
}

/**
 * Filters the model's output against the candidate's real data: any
 * work-history entryId or skill the model didn't actually receive is
 * dropped rather than trusted, in case structured output still lets
 * something slip through (e.g. a hallucinated id).
 */
export function sanitizeTailoredContent(
  raw: TailoredContent,
  allowedEntryIds: Set<string>,
  allowedSkills: string[]
): TailoredContent {
  const skillByLowercase = new Map(allowedSkills.map((s) => [s.toLowerCase(), s]));

  const orderedSkills = raw.orderedSkills
    .map((s) => skillByLowercase.get(s.toLowerCase()))
    .filter((s): s is string => s !== undefined);

  const workHistory = raw.workHistory.filter((w) => allowedEntryIds.has(w.entryId));

  return { summary: raw.summary, workHistory, orderedSkills };
}

export async function tailorResume(userId: string, resumeId: string): Promise<void> {
  const resume = await getResume(userId, resumeId);
  if (!resume) throw new ResumeNotFoundError();

  await assertUnderDailyLimit(userId, "tailoring", getDailyLimit());

  const resumeFields = await getResumeFields(userId);
  if (!resumeFields) throw new ProfileIncompleteError();

  const result = await generateTailoredContent(resumeFields, resume.jobDescription);

  const allowedEntryIds = new Set(resumeFields.workHistory.map((w) => w.id));
  const allowedSkills = [
    ...resumeFields.skills.languages,
    ...resumeFields.skills.frameworks,
    ...resumeFields.skills.tools,
    ...resumeFields.skills.softSkills,
  ];
  const content = sanitizeTailoredContent(result.content, allowedEntryIds, allowedSkills);

  const dek = await getUserDek(userId);
  const tailoredContentEnc = encryptJson(dek, content);

  await db.resume.updateMany({
    where: { id: resumeId, userId },
    data: {
      tailoredContentEnc,
      modelUsed: result.model,
      promptVersion: TAILORING_PROMPT_VERSION,
      generatedAt: new Date(),
      status: resume.status === "DRAFT" ? "GENERATED" : resume.status,
    },
  });

  await recordUsageEvent({
    userId,
    resumeId,
    kind: "tailoring",
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });
}

export async function getTailoredContent(
  userId: string,
  resumeId: string
): Promise<TailoredContent | null> {
  const resume = await db.resume.findFirst({
    where: { id: resumeId, userId },
    select: { tailoredContentEnc: true },
  });
  if (!resume?.tailoredContentEnc) return null;

  const dek = await getUserDek(userId);
  return decryptJson<TailoredContent>(dek, resume.tailoredContentEnc);
}
