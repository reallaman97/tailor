import { db } from "@/lib/db";
import { getResume, scopeFilter, ResumeNotFoundError } from "@/lib/resumes/resumes";
import { getResumeFields } from "@/lib/profile/resume-fields";
import { getAssignedProfileId } from "@/lib/profile/shared";
import { getProfileDek } from "@/lib/profile/dek";
import { encryptJson, decryptJson } from "@/lib/profile/crypto";
import { generateTailoredContent, TAILORING_PROMPT_VERSION } from "@/lib/tailoring/generate";
import { recordUsageEvent } from "@/lib/tailoring/usage";
import { getSettings } from "@/lib/settings";
import type { TailoredContent, StoredTailoredContent } from "@/lib/tailoring/schema";

export class ProfileIncompleteError extends Error {
  constructor() {
    super("Save your personal info before generating a tailored resume");
  }
}

const MAX_SKILLS = 50;

/**
 * Filters the model's output against the candidate's real data:
 * - work-history entries whose id wasn't given are dropped (guards against a
 *   hallucinated id breaking the bullet→entry mapping);
 * - certifications are matched (case-insensitively) to the candidate's real
 *   certifications — a fabricated one is dropped (the prompt forbids inventing
 *   certifications);
 * - skills are deliberately NOT restricted to the profile: the tailoring prompt
 *   intentionally adds JD-required and ecosystem keywords for ATS coverage. We
 *   only tidy them (trim, dedupe, drop empties/categories, cap the total).
 */
export function sanitizeTailoredContent(
  raw: TailoredContent,
  allowedEntryIds: Set<string>,
  allowedCertNames: string[]
): TailoredContent {
  const workHistory = raw.workHistory.filter((w) => allowedEntryIds.has(w.entryId));

  const seenSkill = new Set<string>();
  let skillCount = 0;
  const skillCategories = raw.skillCategories
    .map((cat) => {
      const skills: string[] = [];
      for (const s of cat.skills) {
        const trimmed = s.trim();
        if (!trimmed) continue;
        const key = trimmed.toLowerCase();
        if (seenSkill.has(key) || skillCount >= MAX_SKILLS) continue;
        seenSkill.add(key);
        skills.push(trimmed);
        skillCount++;
      }
      return { category: cat.category.trim(), skills };
    })
    .filter((cat) => cat.category.length > 0 && cat.skills.length > 0);

  const certByLower = new Map(allowedCertNames.map((n) => [n.toLowerCase(), n]));
  const seenCert = new Set<string>();
  const orderedCertifications: string[] = [];
  for (const name of raw.orderedCertifications) {
    const match = certByLower.get(name.trim().toLowerCase());
    if (match && !seenCert.has(match)) {
      seenCert.add(match);
      orderedCertifications.push(match);
    }
  }

  return { summary: raw.summary, workHistory, skillCategories, orderedCertifications };
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

  // Multi-tenancy: use the application's team's settings + OpenAI key.
  const teamRow = await db.resume.findUnique({ where: { id: resumeId }, select: { teamId: true } });
  const teamId = teamRow?.teamId ?? null;

  const settings = await getSettings(teamId);
  const result = await generateTailoredContent(resumeFields, resume.jobDescription, {
    model: settings.openaiModel,
    systemPrompt: settings.tailoringPrompt,
    teamId,
  });

  const allowedEntryIds = new Set(resumeFields.workHistory.map((w) => w.id));
  const allowedCertNames = resumeFields.certifications.map((c) => c.name);
  const content = sanitizeTailoredContent(result.content, allowedEntryIds, allowedCertNames);

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
): Promise<StoredTailoredContent | null> {
  if (!tailoredContentEnc || !profileId) return null;
  const dek = await getProfileDek(profileId);
  return decryptJson<StoredTailoredContent>(dek, tailoredContentEnc);
}

/** Fetches and decrypts tailored content by resume id, scoped to `userId`. */
export async function getTailoredContent(
  userId: string,
  resumeId: string
): Promise<StoredTailoredContent | null> {
  const scope = await scopeFilter(userId);
  const resume = await db.resume.findFirst({
    where: { id: resumeId, ...scope },
    select: { profileId: true, tailoredContentEnc: true },
  });
  if (!resume) return null;
  return decryptTailoredContent(resume.profileId, resume.tailoredContentEnc);
}
