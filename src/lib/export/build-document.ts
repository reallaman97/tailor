import type { ResumeFields } from "@/lib/profile/resume-fields";
import type { StoredTailoredContent } from "@/lib/tailoring/schema";

export type ResumeDocument = {
  fullName: string;
  /** Tailored professional title/tagline under the name; null when not tailored. */
  headline: string | null;
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
  certifications: Array<{
    name: string;
    issuer: string | null;
    issueDate: string | null;
  }>;
  /** Skills grouped into categories (ATS-friendly). */
  skills: Array<{ category: string; skills: string[] }>;
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

/** Skills come from (in priority): tailored categories, legacy flat order, then the profile's own groups. */
function buildSkills(
  resumeFields: ResumeFields,
  tailored: StoredTailoredContent | null
): ResumeDocument["skills"] {
  if (tailored?.skillCategories && tailored.skillCategories.length > 0) {
    return tailored.skillCategories.filter((c) => c.skills.length > 0);
  }
  if (tailored?.orderedSkills && tailored.orderedSkills.length > 0) {
    return [{ category: "Skills", skills: tailored.orderedSkills }];
  }
  return resumeFields.skills.map((g) => ({ category: g.category, skills: g.skills }));
}

/**
 * Certifications always come from the real profile — the tailored
 * `orderedCertifications` only reprioritizes them (matched by name). Any real
 * certification not named by the model is kept, appended after the ordered ones,
 * so nothing real is silently dropped and nothing fabricated is added.
 */
function buildCertifications(
  resumeFields: ResumeFields,
  orderedNames: string[] | undefined
): ResumeDocument["certifications"] {
  const certs = resumeFields.certifications;
  if (!orderedNames || orderedNames.length === 0) return certs;

  const byLower = new Map(certs.map((c) => [c.name.toLowerCase(), c]));
  const used = new Set<string>();
  const ordered: ResumeDocument["certifications"] = [];
  for (const name of orderedNames) {
    const key = name.toLowerCase();
    const cert = byLower.get(key);
    if (cert && !used.has(key)) {
      used.add(key);
      ordered.push(cert);
    }
  }
  for (const cert of certs) {
    if (!used.has(cert.name.toLowerCase())) ordered.push(cert);
  }
  return ordered;
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
  tailoredContent: StoredTailoredContent | null
): ResumeDocument {
  const tailoredByEntryId = new Map((tailoredContent?.workHistory ?? []).map((w) => [w.entryId, w]));

  const workHistory = [...resumeFields.workHistory]
    .sort(byStartDateDesc)
    .map((entry) => ({
      company: entry.company,
      // The prompt may realign a role's title toward the target job; company,
      // dates, and location always stay the profile's own.
      jobTitle: tailoredByEntryId.get(entry.id)?.jobTitle?.trim() || entry.jobTitle,
      location: entry.location,
      workingStyle: entry.workingStyle,
      workingType: entry.workingType,
      startDate: entry.startDate,
      endDate: entry.endDate,
      bullets: tailoredByEntryId.get(entry.id)?.bullets ?? entry.achievements,
    }));

  const education = [...resumeFields.education].sort(byOptionalStartDateDesc);

  return {
    fullName: resumeFields.fullName,
    headline: tailoredContent?.headline?.trim() || null,
    contactEmail: resumeFields.contactEmail,
    phone: resumeFields.phone,
    linkedinUrl: resumeFields.linkedinUrl,
    city: resumeFields.city,
    state: resumeFields.state,
    summary: tailoredContent?.summary ?? resumeFields.professionalSummary,
    workHistory,
    education,
    certifications: buildCertifications(resumeFields, tailoredContent?.orderedCertifications),
    skills: buildSkills(resumeFields, tailoredContent),
  };
}
