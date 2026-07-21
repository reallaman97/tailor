import { z } from "zod";

export const roleTrackSchema = z.enum([
  "BACKEND",
  "FRONTEND",
  "FULL_STACK",
  "DEVOPS_CLOUD",
  "DATA",
  "AI_ML",
  "SUPPORT_OPS",
  "MOBILE",
  "OTHER",
]);

export const applicationSourceSchema = z.enum(["JOB_BOARD", "LINKEDIN_OUTREACH", "RECRUITER", "OTHER"]);

export const approvalStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);

export const resumeStatusSchema = z.enum([
  "DRAFT",
  "APPLIED",
  "REPLY",
  "INTRO",
  "TECH1",
  "TECH2",
  "FINAL",
  "OFFER",
  "FAIL",
  "CANCELED",
]);

export const createResumeSchema = z.object({
  jobLink: z.union([z.url(), z.literal("")]).optional(),
  companyName: z.string().trim().min(1, "Company name is required").max(200, "Company name is too long"),
  jobTitle: z.string().trim().min(1, "Job title is required").max(200, "Job title is too long"),
  // Cap length: this text is both stored and forwarded to the paid LLM, so an
  // unbounded paste is a storage + cost-amplification vector. ~20k chars is
  // well beyond any real posting.
  jobDescription: z
    .string()
    .trim()
    .min(20, "Paste the full job description (at least 20 characters)")
    .max(20_000, "Job description is too long (max 20,000 characters)"),
  // roleTrack is always AI-classified server-side and never trusted from a
  // client; status/source are set by the server action per who's creating it
  // (a normal user's own application vs. a superadmin building on behalf of
  // another user) — both are optional here purely so those call sites can
  // pass them through the same validated shape.
  roleTrack: roleTrackSchema.optional(),
  source: applicationSourceSchema.optional(),
  status: resumeStatusSchema.optional(),
});

export type CreateResumeInput = z.infer<typeof createResumeSchema>;

export const updateResumeStatusSchema = z.object({
  statuses: z.array(resumeStatusSchema).min(1, "At least one status is required"),
});

// roleTrack is deliberately absent — it's AI-classified at creation time and
// never manually editable, by anyone, afterward.
export const updateResumeDetailsSchema = z.object({
  source: applicationSourceSchema,
  notes: z
    .string()
    .max(5_000, "Notes are too long (max 5,000 characters)")
    .optional()
    .transform((value) => (value && value.trim() !== "" ? value.trim() : undefined)),
});

export type UpdateResumeDetailsInput = z.infer<typeof updateResumeDetailsSchema>;
