import { z } from "zod";

const optionalTrimmed = z
  .string()
  .optional()
  .transform((value) => (value && value.trim() !== "" ? value.trim() : undefined));

const isoDateOptional = z
  .union([z.iso.date(), z.literal("")])
  .optional()
  .transform((value) => (value ? value : undefined));

// Work history and education only track month/year precision — an HTML
// <input type="month"> submits exactly this "YYYY-MM" shape.
const YEAR_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const yearMonthOptional = z
  .union([z.string().regex(YEAR_MONTH_PATTERN), z.literal("")])
  .optional()
  .transform((value) => (value ? value : undefined));

export const personalInfoSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required"),
  contactEmail: z.email(),
  phone: z.string().trim().min(1, "Phone number is required"),
  linkedinUrl: z.union([z.url(), z.literal("")]).optional(),
  professionalSummary: optionalTrimmed,
  city: optionalTrimmed,
  state: optionalTrimmed,
  // Reference-only — never sent to tailoring/export.
  dateOfBirth: isoDateOptional,
  addressLine1: optionalTrimmed,
  addressLine2: optionalTrimmed,
  postalCode: optionalTrimmed,
  country: optionalTrimmed,
});

export type PersonalInfoInput = z.infer<typeof personalInfoSchema>;

const workingStyleOptional = z
  .union([z.enum(["FULL_TIME", "PART_TIME", "CONTRACT"]), z.literal("")])
  .optional()
  .transform((value) => (value ? value : undefined));

const workingTypeOptional = z
  .union([z.enum(["REMOTE", "HYBRID", "ON_SITE"]), z.literal("")])
  .optional()
  .transform((value) => (value ? value : undefined));

export const workHistoryEntrySchema = z.object({
  company: z.string().trim().min(1, "Company is required"),
  jobTitle: z.string().trim().min(1, "Job title is required"),
  location: optionalTrimmed,
  workingStyle: workingStyleOptional,
  workingType: workingTypeOptional,
  startDate: z.string().regex(YEAR_MONTH_PATTERN, "Start date is required"),
  endDate: yearMonthOptional, // omitted/empty = current role
  achievements: z
    .string()
    .optional()
    .transform((value) =>
      (value ?? "")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
    ),
});

export type WorkHistoryEntryInput = z.infer<typeof workHistoryEntrySchema>;

export const educationEntrySchema = z.object({
  institution: z.string().trim().min(1, "Institution is required"),
  degree: z.string().trim().min(1, "Degree is required"),
  field: optionalTrimmed,
  startDate: yearMonthOptional,
  endDate: yearMonthOptional,
});

export type EducationEntryInput = z.infer<typeof educationEntrySchema>;

export const skillGroupSchema = z.object({
  category: z.string().trim().min(1, "Category name is required"),
  skills: z
    .string()
    .transform((value) =>
      value
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    ),
});

export type SkillGroupInput = z.infer<typeof skillGroupSchema>;
