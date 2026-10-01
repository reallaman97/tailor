import { db } from "@/lib/db";
import { getResume, scopeFilter, ResumeNotFoundError } from "@/lib/resumes/resumes";
import { getResumeFields } from "@/lib/profile/resume-fields";
import { getAssignedProfileId } from "@/lib/profile/shared";
import { getBaseResumeStatus } from "@/lib/base-resume/status";
import { getProfileDek } from "@/lib/profile/dek";
import { encryptJson, decryptJson } from "@/lib/profile/crypto";
import { generateTailoredContent, TAILORING_PROMPT_VERSION } from "@/lib/tailoring/generate";
import { recordUsageEvent } from "@/lib/tailoring/usage";
import { getSettings } from "@/lib/settings";
import type { ModelOutput, TailoredContent, StoredTailoredContent, ValidationReport } from "@/lib/tailoring/schema";

export const NO_BASE_RESUME_MESSAGE =
  "This profile has no base resume yet — an admin must upload the candidate's full resume on the profile page before tailored resumes can be generated.";

export class ProfileIncompleteError extends Error {
  constructor(message = "Save your personal info before generating a tailored resume") {
    super(message);
  }
}

const MAX_SKILLS = 90;
const MAX_TITLE_LENGTH = 100;
const MAX_REPORT_NOTES = 12;

function clampPercent(value: number): number {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0;
}

function sanitizeReport(report: ModelOutput["validationReport"]): ValidationReport {
  return {
    atsMatchScore: clampPercent(report.atsMatchScore),
    aiProbability: clampPercent(report.aiProbability),
    researchContributionCheck: report.researchContributionCheck.trim(),
    evidencePlacementCheck: report.evidencePlacementCheck.trim(),
    titleRealismCheck: report.titleRealismCheck.trim(),
    gapsAndRisks: report.gapsAndRisks
      .map((note) => note.trim())
      .filter(Boolean)
      .slice(0, MAX_REPORT_NOTES),
  };
}

/**
 * Maps the model's answer onto the candidate's real data:
 * - work-history entries whose id wasn't given are dropped (guards against a
 *   hallucinated id breaking the bullet→entry mapping). Company, dates, and
 *   location are never taken from the model — only the (realigned) title and
 *   bullets, which the prompt explicitly allows changing;
 * - certifications are matched (case-insensitively) to the candidate's real
 *   certifications — a fabricated one is dropped (the prompt forbids inventing
 *   certifications);
 * - skills aren't restricted to the profile (the prompt adds required JD skills
 *   where plausible); they're only tidied (trim, dedupe, drop empties, cap).
 */
export function sanitizeTailoredContent(
  raw: ModelOutput,
  allowedEntryIds: Set<string>,
  allowedCertNames: string[]
): TailoredContent {
  const seenEntry = new Set<string>();
  const workHistory: TailoredContent["workHistory"] = [];
  for (const entry of raw.resume.experience) {
    if (!allowedEntryIds.has(entry.entryId) || seenEntry.has(entry.entryId)) continue;
    seenEntry.add(entry.entryId);
    workHistory.push({
      entryId: entry.entryId,
      jobTitle: entry.jobTitle.trim().slice(0, MAX_TITLE_LENGTH),
      bullets: entry.bullets.map((b) => b.trim()).filter(Boolean),
    });
  }

  const seenSkill = new Set<string>();
  let skillCount = 0;
  const skillCategories = raw.resume.skills
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
  for (const name of raw.resume.certifications) {
    const match = certByLower.get(name.trim().toLowerCase());
    if (match && !seenCert.has(match)) {
      seenCert.add(match);
      orderedCertifications.push(match);
    }
  }

  // Cap the headline defensively (a title line, not a paragraph).
  const headline = raw.resume.headline.trim().slice(0, 160);

  return {
    headline,
    summary: raw.resume.summary.trim(),
    workHistory,
    skillCategories,
    orderedCertifications,
    validationReport: sanitizeReport(raw.validationReport),
  };
}

export async function tailorResume(userId: string, resumeId: string): Promise<void> {
  const resume = await getResume(userId, resumeId);
  if (!resume) throw new ResumeNotFoundError();

  const resumeFields = await getResumeFields(userId);
  if (!resumeFields) throw new ProfileIncompleteError();
  // The prompt only asks for confirmation when the resume is missing — catch
  // that here instead of paying for a call that can't produce a resume.
  if (resumeFields.workHistory.length === 0) {
    throw new ProfileIncompleteError("Add work history to the profile before generating a tailored resume");
  }

  // Tailored content is encrypted with the PROFILE's DEK (not the caller's
  // account DEK) so any team member sharing that profile can read it back —
  // re-synced here in case the profile assignment changed since creation.
  const profileId = await getAssignedProfileId(userId);
  if (!profileId) throw new ProfileIncompleteError();

  // The prompt tailors an existing resume ("keep it close to the original
  // length"), so generating from a profile that was never given a full base
  // resume produces thin, JD-invented content. Require one first.
  if (!(await getBaseResumeStatus(profileId))) throw new ProfileIncompleteError(NO_BASE_RESUME_MESSAGE);

  // Multi-tenancy: the application's team picks the DeepSeek model.
  const teamRow = await db.resume.findUnique({ where: { id: resumeId }, select: { teamId: true } });
  const teamId = teamRow?.teamId ?? null;

  const settings = await getSettings(teamId);
  const result = await generateTailoredContent(resumeFields, resume.jobDescription, {
    model: settings.resumeModel,
  });

  const allowedEntryIds = new Set(resumeFields.workHistory.map((w) => w.id));
  const allowedCertNames = resumeFields.certifications.map((c) => c.name);
  const content = sanitizeTailoredContent(result.output, allowedEntryIds, allowedCertNames);

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
    cachedInputTokens: result.cachedInputTokens,
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
