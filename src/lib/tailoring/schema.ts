import { z } from "zod";

/**
 * The structure the model is asked to return. `skillCategories` groups skills
 * into 4–7 ATS categories (per the tailoring prompt); `orderedCertifications`
 * lists certification names in priority order — selected/reordered from the
 * candidate's real certifications only (rendering sources certs from the
 * profile, so a fabricated name simply won't match anything).
 */
export const tailoredContentSchema = z.object({
  summary: z.string(),
  workHistory: z.array(
    z.object({
      entryId: z.string(),
      bullets: z.array(z.string()),
    })
  ),
  skillCategories: z.array(
    z.object({
      category: z.string(),
      skills: z.array(z.string()),
    })
  ),
  orderedCertifications: z.array(z.string()),
});

export type TailoredContent = z.infer<typeof tailoredContentSchema>;

/**
 * The looser shape read back from storage. Older resumes were generated before
 * categorized skills / certifications and stored a flat `orderedSkills` with no
 * `skillCategories` or `orderedCertifications` — the renderer tolerates both.
 */
export type StoredTailoredContent = {
  summary: string;
  workHistory: { entryId: string; bullets: string[] }[];
  /** Legacy flat skill order (pre-categorization). */
  orderedSkills?: string[];
  skillCategories?: { category: string; skills: string[] }[];
  orderedCertifications?: string[];
};
