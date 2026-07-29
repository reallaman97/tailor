import { z } from "zod";
import { CUSTOM_FIELD_DEFS } from "@/lib/interview/fields";

/** A URL field that accepts a real URL or an empty string (the repo idiom). */
const optionalUrl = z.union([z.url(), z.literal("")]).optional();

/** Trims to `undefined` when blank — keeps optional text columns null, not "". */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .max(max, `${label} is too long (max ${max.toLocaleString()} characters)`)
    .optional()
    .transform((value) => (value && value.trim() !== "" ? value.trim() : undefined));

/**
 * Dynamic validator for the JSON `meta` blob, built from CUSTOM_FIELD_DEFS so a
 * new custom field is validated automatically with no code change here. Returns
 * a plain object suitable for storing in the Prisma Json column.
 */
export const metaSchema = z
  .record(z.string(), z.union([z.string(), z.number(), z.null()]))
  .optional()
  .transform((raw) => {
    const source = raw ?? {};
    const out: Record<string, string | number> = {};
    for (const def of CUSTOM_FIELD_DEFS) {
      const value = source[def.key];
      if (value === undefined || value === null || value === "") continue;
      if (def.type === "number") {
        const n = typeof value === "number" ? value : Number(value);
        if (Number.isFinite(n)) out[def.key] = n;
      } else {
        out[def.key] = String(value).slice(0, 5_000);
      }
    }
    return out;
  });

/**
 * Core interview fields, shared by create and edit. `scheduledAt` is the raw
 * `datetime-local` string (interpreted in the Settings timezone by the action
 * layer). The config FKs (stage/status/meetingType) and caller/application are
 * optional ids validated against real rows in the domain layer.
 */
const interviewCoreSchema = z.object({
  jobTitle: z.string().trim().min(1, "Job title is required").max(200, "Job title is too long"),
  companyName: z.string().trim().min(1, "Company is required").max(200, "Company is too long"),
  jobDescription: optionalText(20_000, "Job description"),
  jobPostLink: optionalUrl,
  salaryRange: optionalText(200, "Salary range"),
  scheduledAt: z.string().optional(),
  meetingLink: optionalUrl,
  interviewerInfo: optionalText(10_000, "Interviewer info"),
  stageId: z.string().optional(),
  statusId: z.string().optional(),
  meetingTypeId: z.string().optional(),
  callerId: z.string().optional(),
  profileId: z.string().optional(),
  meta: metaSchema,
});

export const createInterviewSchema = interviewCoreSchema.extend({
  /** When present, the interview links to this Application and pre-fills from it. */
  applicationId: z.string().optional(),
});

export const updateInterviewSchema = interviewCoreSchema;

export type CreateInterviewFields = z.infer<typeof createInterviewSchema>;
export type UpdateInterviewFields = z.infer<typeof updateInterviewSchema>;

export const commentSchema = z.object({
  body: z.string().trim().min(1, "Comment can't be empty").max(5_000, "Comment is too long (max 5,000 characters)"),
});

/** Single FK status change (Callers may do this on their own interviews). Empty = clear. */
export const updateStatusSchema = z.object({
  statusId: z.string().optional().transform((v) => (v && v.trim() !== "" ? v.trim() : undefined)),
});

/** Assign (or, with empty, unassign) a Caller. */
export const assignCallerSchema = z.object({
  callerId: z.string().optional().transform((v) => (v && v.trim() !== "" ? v.trim() : undefined)),
});

// ── Config (Settings) ──────────────────────────────────

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export const configLabelSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(60, "Name is too long (max 60 characters)");

export const statusConfigSchema = z.object({
  label: configLabelSchema,
  color: z
    .string()
    .trim()
    .regex(HEX_COLOR, "Color must be a hex value like #3b82f6"),
});

export const timezoneSchema = z.object({
  interviewTimezone: z.string().trim().min(1, "Timezone is required"),
});

export type StatusConfigInput = z.infer<typeof statusConfigSchema>;

/**
 * Reconstructs the `meta` object from a flat FormData, reading one field per
 * CUSTOM_FIELD_DEFS entry (named `meta.<key>`). This is the extensibility seam:
 * add a custom field def and its value flows through with no change here.
 */
export function metaFromFormData(formData: FormData): Record<string, string | number> {
  const raw: Record<string, string> = {};
  for (const def of CUSTOM_FIELD_DEFS) {
    const value = formData.get(`meta.${def.key}`);
    if (typeof value === "string") raw[def.key] = value;
  }
  return metaSchema.parse(raw);
}
