import { getAssignedProfileId } from "@/lib/profile/shared";
import { getPersonalInfo } from "@/lib/profile/personal-info";
import { listWorkHistory } from "@/lib/profile/work-history";
import { listEducation } from "@/lib/profile/education";
import { listCertifications } from "@/lib/profile/certifications";
import { listSkillGroups } from "@/lib/profile/skills";
import type { WorkingStyle, WorkingType } from "@/generated/prisma/client";

export type ResumeFields = {
  fullName: string;
  contactEmail: string;
  phone: string;
  linkedinUrl: string | null;
  professionalSummary: string | null;
  city: string | null;
  state: string | null;
  workHistory: Array<{
    id: string;
    company: string;
    jobTitle: string;
    location: string | null;
    workingStyle: WorkingStyle | null;
    workingType: WorkingType | null;
    startDate: string;
    endDate: string | null;
    achievements: string[];
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
  skills: Array<{
    category: string;
    skills: string[];
  }>;
};

/**
 * The ONLY sanctioned path from Profile to anything that leaves this app's
 * database — tailoring/export/LLM calls. Deliberately omits dateOfBirth and
 * the full street address (reference-only fields): they are not read here,
 * not passed through, and so cannot leak downstream no matter what callers
 * do with the return value.
 *
 * Returns null if the profile has no personal info saved yet.
 */
export async function getResumeFieldsForProfile(profileId: string): Promise<ResumeFields | null> {
  const [personalInfo, workHistory, education, certifications, skillGroups] = await Promise.all([
    getPersonalInfo(profileId),
    listWorkHistory(profileId),
    listEducation(profileId),
    listCertifications(profileId),
    listSkillGroups(profileId),
  ]);

  if (!personalInfo) return null;

  return {
    fullName: personalInfo.fullName,
    contactEmail: personalInfo.contactEmail,
    phone: personalInfo.phone,
    linkedinUrl: personalInfo.linkedinUrl,
    professionalSummary: personalInfo.professionalSummary,
    city: personalInfo.city,
    state: personalInfo.state,
    workHistory: workHistory.map((w) => ({
      id: w.id,
      company: w.company,
      jobTitle: w.jobTitle,
      location: w.location,
      workingStyle: w.workingStyle,
      workingType: w.workingType,
      startDate: w.startDate,
      endDate: w.endDate,
      achievements: w.achievements,
    })),
    education: education.map((e) => ({
      institution: e.institution,
      degree: e.degree,
      field: e.field,
      startDate: e.startDate,
      endDate: e.endDate,
    })),
    certifications: certifications.map((c) => ({
      name: c.name,
      issuer: c.issuer,
      issueDate: c.issueDate,
    })),
    skills: skillGroups
      .filter((g) => g.skills.length > 0)
      .map((g) => ({ category: g.category, skills: g.skills })),
  };
}

/**
 * Resume fields for the profile CURRENTLY assigned to `userId`. Use this for
 * generation, where "which candidate am I tailoring for" is the caller's live
 * assignment. Returns null if the user has no profile, or it has no info yet.
 */
export async function getResumeFields(userId: string): Promise<ResumeFields | null> {
  const profileId = await getAssignedProfileId(userId);
  if (!profileId) return null;
  return getResumeFieldsForProfile(profileId);
}

/**
 * Resume fields for rendering/exporting a specific resume: anchored to the
 * profile the resume was logged/generated against (`resumeProfileId`), NOT the
 * owner's current assignment. This keeps a rendered/exported resume's personal
 * info aligned with its tailored content — both come from the same profile —
 * even after the owner is reassigned to a different candidate profile.
 *
 * Falls back to the owner's current assignment only when the resume was never
 * associated with a profile (a draft logged before any assignment).
 */
export async function getResumeFieldsForResume(
  ownerUserId: string,
  resumeProfileId: string | null
): Promise<ResumeFields | null> {
  const profileId = resumeProfileId ?? (await getAssignedProfileId(ownerUserId));
  if (!profileId) return null;
  return getResumeFieldsForProfile(profileId);
}
