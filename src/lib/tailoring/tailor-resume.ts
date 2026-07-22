import { db } from "@/lib/db";
import { getResume, scopeFilter, ResumeNotFoundError } from "@/lib/resumes/resumes";
import { getResumeFields } from "@/lib/profile/resume-fields";
import { getAssignedProfileId } from "@/lib/profile/shared";
import { getProfileDek } from "@/lib/profile/dek";
import { encryptJson, decryptJson } from "@/lib/profile/crypto";
import { generateTailoredContent, TAILORING_PROMPT_VERSION } from "@/lib/tailoring/generate";
import { recordUsageEvent } from "@/lib/tailoring/usage";
import { getSettings } from "@/lib/settings";
import type { TailoredContent } from "@/lib/tailoring/schema";

export class ProfileIncompleteError extends Error {
  constructor() {
    super("Save your personal info before generating a tailored resume");
  }
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

  const resumeFields = await getResumeFields(userId);
  if (!resumeFields) throw new ProfileIncompleteError();

  // Tailored content is encrypted with the PROFILE's DEK (not the caller's
  // account DEK) so any team member sharing that profile can read it back —
  // re-synced here in case the profile assignment changed since creation.
  const profileId = await getAssignedProfileId(userId);
  if (!profileId) throw new ProfileIncompleteError();

  const settings = await getSettings();
  const result = await generateTailoredContent(resumeFields, resume.jobDescription, {
    model: settings.openaiModel,
    systemPrompt: settings.tailoringPrompt,
  });

  const allowedEntryIds = new Set(resumeFields.workHistory.map((w) => w.id));
  const allowedSkills = resumeFields.skills.flatMap((g) => g.skills);
  const content = sanitizeTailoredContent(result.content, allowedEntryIds, allowedSkills);

  const dek = await getProfileDek(profileId);
  const tailoredContentEnc = encryptJson(dek, content);

  await db.resume.update({
    where: { id: resumeId },
    data: {
      profileId,
      tailoredContentEnc,
      modelUsed: result.model,
      promptVersion: TAILORING_PROMPT_VERSION,
      generatedAt: new Date(),
      // Generating content is a drafting step, not a pipeline transition —
      // the applicant's actual submission status only moves via the status control.
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

/**
 * Decrypt already-loaded tailored content. Use this when the caller already has
 * the resume's `profileId` and `tailoredContentEnc` in hand (e.g. a page that
 * just fetched the resume) — it costs a single DEK lookup, skipping the scope
 * check + resume re-fetch that {@link getTailoredContent} does.
 */
export async function decryptTailoredContent(
  profileId: string | null,
  tailoredContentEnc: string | null
): Promise<TailoredContent | null> {
  if (!tailoredContentEnc || !profileId) return null;
  const dek = await getProfileDek(profileId);
  return decryptJson<TailoredContent>(dek, tailoredContentEnc);
}

/** Fetches and decrypts tailored content by resume id, scoped to `userId`. */
export async function getTailoredContent(
  userId: string,
  resumeId: string
): Promise<TailoredContent | null> {
  const scope = await scopeFilter(userId);
  const resume = await db.resume.findFirst({
    where: { id: resumeId, ...scope },
    select: { profileId: true, tailoredContentEnc: true },
  });
  if (!resume) return null;
  return decryptTailoredContent(resume.profileId, resume.tailoredContentEnc);
}
