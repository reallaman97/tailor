import { z } from "zod";

export const createResumeSchema = z.object({
  jobLink: z.union([z.url(), z.literal("")]).optional(),
  companyName: z.string().trim().min(1, "Company name is required"),
  jobTitle: z.string().trim().min(1, "Job title is required"),
  jobDescription: z
    .string()
    .trim()
    .min(20, "Paste the full job description (at least 20 characters)"),
});

export type CreateResumeInput = z.infer<typeof createResumeSchema>;

export const resumeStatusSchema = z.enum([
  "DRAFT",
  "GENERATED",
  "APPLIED",
  "INTERVIEWING",
  "OFFER",
  "REJECTED",
  "ARCHIVED",
]);

export const updateResumeStatusSchema = z.object({
  status: resumeStatusSchema,
});
