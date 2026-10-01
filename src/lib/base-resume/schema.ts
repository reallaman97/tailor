import { z } from "zod";
import { toYearMonth, type ExtractedContact, type VerbatimCheck } from "@/lib/base-resume/text";

const WORKING_STYLES = ["FULL_TIME", "PART_TIME", "CONTRACT"] as const;
const WORKING_TYPES = ["REMOTE", "HYBRID", "ON_SITE"] as const;

const text = z.string().catch("").transform((v) => v.trim());
const optionalText = z
  .string()
  .nullable()
  .catch(null)
  .transform((v) => (v && v.trim() ? v.trim() : null));
const yearMonth = z
  .string()
  .nullable()
  .catch(null)
  .transform((v) => toYearMonth(v));
const textList = z
  .array(z.string())
  .catch([])
  .transform((list) => list.map((s) => s.trim()).filter(Boolean));

/**
 * A parsed base resume. Lenient on purpose: it both reads the parser model's
 * answer (which may omit or garble fields) and re-validates the reviewed draft
 * posted back by the admin. Hard requirements are checked by draftIssues().
 */
export const baseResumeDraftSchema = z.object({
  fullName: text,
  city: optionalText,
  state: optionalText,
  summary: text,
  workHistory: z
    .array(
      z.object({
        company: text,
        jobTitle: text,
        location: optionalText,
        workingStyle: z.enum(WORKING_STYLES).nullable().catch(null),
        workingType: z.enum(WORKING_TYPES).nullable().catch(null),
        startDate: yearMonth,
        endDate: yearMonth,
        bullets: textList,
      })
    )
    .catch([]),
  education: z
    .array(
      z.object({
        institution: text,
        degree: text,
        field: optionalText,
        startDate: yearMonth,
        endDate: yearMonth,
      })
    )
    .catch([]),
  certifications: z
    .array(
      z.object({
        name: text,
        issuer: optionalText,
        issueDate: yearMonth,
      })
    )
    .catch([]),
  skills: z
    .array(
      z.object({
        category: text,
        skills: textList,
      })
    )
    .catch([]),
});

export type BaseResumeDraft = z.infer<typeof baseResumeDraftSchema>;

/**
 * What the parse route returns: the parsed draft plus what the review form
 * needs around it. Anything missing or invalid is surfaced as field errors in
 * the review form (see reviewed-profile.ts), where the admin fixes it.
 */
export type BaseResumeImport = {
  draft: BaseResumeDraft;
  contact: ExtractedContact;
  /** Normalized extracted text — stored (encrypted) as the profile's base resume. */
  sourceText: string;
  fileName: string | null;
  check: VerbatimCheck;
};
