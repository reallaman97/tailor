import type { ResumeFields } from "@/lib/profile/resume-fields";
import type { TailoredContent } from "@/lib/tailoring/schema";

export type ResumeDocument = {
  fullName: string;
  contactEmail: string;
  phone: string;
  linkedinUrl: string | null;
  city: string | null;
  state: string | null;
  summary: string | null;
  workHistory: Array<{
    company: string;
    jobTitle: string;
    location: string | null;
    workingStyle: ResumeFields["workHistory"][number]["workingStyle"];
    workingType: ResumeFields["workHistory"][number]["workingType"];
    startDate: string;
    endDate: string | null;
    bullets: string[];
  }>;
  education: Array<{
    institution: string;
    degree: string;
    field: string | null;
    startDate: string | null;
    endDate: string | null;
  }>;
  skills: string[];
};

function byStartDateDesc(a: { startDate: string }, b: { startDate: string }): number {
  return b.startDate.localeCompare(a.startDate);
}

function byOptionalStartDateDesc(
  a: { startDate: string | null },
  b: { startDate: string | null }
): number {
  if (a.startDate === null && b.startDate === null) return 0;
  if (a.startDate === null) return 1;
  if (b.startDate === null) return -1;
  return b.startDate.localeCompare(a.startDate);
}

function defaultSkillOrder(skills: ResumeFields["skills"]): string[] {
  return skills.flatMap((g) => g.skills);
}

/**
 * Merges the candidate's real profile data with (optional) tailored content
 * into a single ready-to-render structure.
 *
 * Ordering and the full set of entries always come from the real profile,
 * never from the tailored content's array order/completeness — the model
 * isn't trusted to preserve order or return every entry it was given.
 * Tailored bullets/skills are only substituted in where they exist.
 */
export function buildResumeDocument(
  resumeFields: ResumeFields,
  tailoredContent: TailoredContent | null
): ResumeDocument {
  const tailoredBulletsByEntryId = new Map(
    (tailoredContent?.workHistory ?? []).map((w) => [w.entryId, w.bullets])
  );

  const workHistory = [...resumeFields.workHistory]
    .sort(byStartDateDesc)
    .map((entry) => ({
      company: entry.company,
      jobTitle: entry.jobTitle,
      location: entry.location,
      workingStyle: entry.workingStyle,
      workingType: entry.workingType,
      startDate: entry.startDate,
      endDate: entry.endDate,
      bullets: tailoredBulletsByEntryId.get(entry.id) ?? entry.achievements,
    }));

  const education = [...resumeFields.education].sort(byOptionalStartDateDesc);

  const skills =
    tailoredContent && tailoredContent.orderedSkills.length > 0
      ? tailoredContent.orderedSkills
      : defaultSkillOrder(resumeFields.skills);

  return {
    fullName: resumeFields.fullName,
    contactEmail: resumeFields.contactEmail,
    phone: resumeFields.phone,
    linkedinUrl: resumeFields.linkedinUrl,
    city: resumeFields.city,
    state: resumeFields.state,
    summary: tailoredContent?.summary ?? resumeFields.professionalSummary,
    workHistory,
    education,
    skills,
  };
}
