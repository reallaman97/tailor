import { z } from "zod";

/**
 * The self-check the resume prompt asks the model to return alongside the
 * updated resume. Shown to team admins only — never to bidders, and never
 * rendered into the PDF.
 */
export const validationReportSchema = z.object({
  /** Estimated ATS match, 0–100. */
  atsMatchScore: z.number(),
  /** Estimated probability the text reads as AI-written, 0–100 (lower is better). */
  aiProbability: z.number(),
  researchContributionCheck: z.string(),
  evidencePlacementCheck: z.string(),
  titleRealismCheck: z.string(),
  gapsAndRisks: z.array(z.string()),
});

export type ValidationReport = z.infer<typeof validationReportSchema>;

/**
 * The model's final output, in the shape the output-format contract asks for
 * (see OUTPUT_FORMAT_CONTRACT in generate.ts). Scores are coerced because
 * models sometimes emit "92" or 92.5 for a number.
 */
export const modelOutputSchema = z.object({
  resume: z.object({
    headline: z.string().default(""),
    summary: z.string(),
    experience: z.array(
      z.object({
        entryId: z.string(),
        jobTitle: z.string().default(""),
        bullets: z.array(z.string()),
      })
    ),
    skills: z
      .array(
        z.object({
          category: z.string(),
          skills: z.array(z.string()),
        })
      )
      .default([]),
    certifications: z.array(z.string()).default([]),
  }),
  validationReport: z.object({
    atsMatchScore: z.coerce.number().catch(0),
    aiProbability: z.coerce.number().catch(0),
    researchContributionCheck: z.string().default(""),
    evidencePlacementCheck: z.string().default(""),
    titleRealismCheck: z.string().default(""),
    gapsAndRisks: z.array(z.string()).default([]),
  }),
});

export type ModelOutput = z.infer<typeof modelOutputSchema>;

/**
 * Tailored content as the app stores it (encrypted) and renders it. Company
 * names, dates, locations, education, and contact details always come from the
 * stored profile — only these fields come from the model.
 */
export type TailoredContent = {
  /** Professional title line rendered under the candidate's name. */
  headline: string;
  summary: string;
  workHistory: {
    entryId: string;
    /** Realigned title for this role; empty = keep the profile's title. */
    jobTitle: string;
    bullets: string[];
  }[];
  skillCategories: { category: string; skills: string[] }[];
  orderedCertifications: string[];
  validationReport: ValidationReport;
};

/**
 * The looser shape read back from storage. Resumes generated before the
 * DeepSeek prompt have no per-role `jobTitle` or `validationReport`, and even
 * older ones stored a flat `orderedSkills` with no `skillCategories` — the
 * renderer tolerates all of them.
 */
export type StoredTailoredContent = {
  headline?: string;
  summary: string;
  workHistory: { entryId: string; jobTitle?: string; bullets: string[] }[];
  /** Legacy flat skill order (pre-categorization). */
  orderedSkills?: string[];
  skillCategories?: { category: string; skills: string[] }[];
  orderedCertifications?: string[];
  validationReport?: ValidationReport;
};
