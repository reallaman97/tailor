import { getPersonalInfo } from "@/lib/profile/personal-info";
import { listWorkHistory } from "@/lib/profile/work-history";
import { listEducation } from "@/lib/profile/education";
import { listSkillGroups } from "@/lib/profile/skills";

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
  skills: {
    languages: string[];
    frameworks: string[];
    tools: string[];
    softSkills: string[];
  };
};

/**
 * The ONLY sanctioned path from Profile to anything that leaves this app's
 * database — tailoring/export/LLM calls. Deliberately omits dateOfBirth and
 * the full street address (reference-only fields): they are not read here,
 * not passed through, and so cannot leak downstream no matter what callers
 * do with the return value.
 *
 * Returns null if the user hasn't saved personal info yet.
 */
export async function getResumeFields(userId: string): Promise<ResumeFields | null> {
  const [personalInfo, workHistory, education, skillGroups] = await Promise.all([
    getPersonalInfo(userId),
    listWorkHistory(userId),
    listEducation(userId),
    listSkillGroups(userId),
  ]);

  if (!personalInfo) return null;

  const skillsByCategory = Object.fromEntries(skillGroups.map((g) => [g.category, g.skills]));

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
    skills: {
      languages: skillsByCategory.LANGUAGES ?? [],
      frameworks: skillsByCategory.FRAMEWORKS ?? [],
      tools: skillsByCategory.TOOLS ?? [],
      softSkills: skillsByCategory.SOFT_SKILLS ?? [],
    },
  };
}
