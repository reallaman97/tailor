import { z } from "zod";

// Mirrors the profile input shape, but uses `.nullable()` instead of
// `.optional()` throughout — OpenAI's strict structured-output mode requires
// every object property to be present, using null for "not known" rather
// than omitting the key.

const workHistoryDraftSchema = z.object({
  company: z.string(),
  jobTitle: z.string(),
  location: z.string().nullable(),
  startDate: z.string().nullable().describe("YYYY-MM-DD; use the 1st of the month if only month/year is known"),
  endDate: z.string().nullable().describe("YYYY-MM-DD, or null if this is the current/ongoing role"),
  achievements: z.array(z.string()),
});

const educationDraftSchema = z.object({
  institution: z.string(),
  degree: z.string(),
  field: z.string().nullable(),
  startDate: z.string().nullable().describe("YYYY-MM-DD; use the 1st of the month if only month/year is known"),
  endDate: z.string().nullable().describe("YYYY-MM-DD; use the 1st of the month if only month/year is known"),
});

export const resumeDraftSchema = z.object({
  personalInfo: z.object({
    fullName: z.string(),
    contactEmail: z.string().nullable(),
    phone: z.string().nullable(),
    linkedinUrl: z.string().nullable(),
    professionalSummary: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
  }),
  workHistory: z.array(workHistoryDraftSchema),
  education: z.array(educationDraftSchema),
  skills: z.object({
    languages: z.array(z.string()),
    frameworks: z.array(z.string()),
    tools: z.array(z.string()),
    softSkills: z.array(z.string()),
  }),
});

export type ResumeDraft = z.infer<typeof resumeDraftSchema>;
export type WorkHistoryDraft = z.infer<typeof workHistoryDraftSchema>;
export type EducationDraft = z.infer<typeof educationDraftSchema>;
