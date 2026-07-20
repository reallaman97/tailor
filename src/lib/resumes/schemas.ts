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
  "GHOSTED",
]);

export const createResumeSchema = z.object({
  jobLink: z.union([z.url(), z.literal("")]).optional(),
  companyName: z.string().trim().min(1, "Company name is required"),
  jobTitle: z.string().trim().min(1, "Job title is required"),
  jobDescription: z
    .string()
    .trim()
    .min(20, "Paste the full job description (at least 20 characters)"),
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

const optionalTrimmed = z
  .string()
  .optional()
  .transform((value) => (value && value.trim() !== "" ? value.trim() : undefined));

// roleTrack is deliberately absent — it's AI-classified at creation time and
// never manually editable, by anyone, afterward.
export const updateResumeDetailsSchema = z.object({
  source: applicationSourceSchema,
  followUpDate: z.union([z.iso.date(), z.literal("")]).optional(),
  notes: optionalTrimmed,
});

export type UpdateResumeDetailsInput = z.infer<typeof updateResumeDetailsSchema>;
