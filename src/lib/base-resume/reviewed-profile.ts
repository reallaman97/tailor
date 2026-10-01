import { z } from "zod";
import type { BaseResumeDraft } from "@/lib/base-resume/schema";
import type { ExtractedContact } from "@/lib/base-resume/text";

// The editable, admin-reviewed version of a parsed base resume — what the
// "New profile" wizard and "Replace base resume" both submit. Pure (zod only),
// so the browser validates with exactly the same rules the server enforces.

const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const WORKING_STYLES = ["FULL_TIME", "PART_TIME", "CONTRACT"] as const;
const WORKING_TYPES = ["REMOTE", "HYBRID", "ON_SITE"] as const;

/** Form state: every field is a string, exactly as the inputs hold it. */
export type ReviewedProfileInput = {
  personal: {
    fullName: string;
    contactEmail: string;
    phone: string;
    linkedinUrl: string;
    city: string;
    state: string;
    professionalSummary: string;
    // Reference-only — never on resumes. Only editable when creating a profile.
    dateOfBirth: string;
    addressLine1: string;
    addressLine2: string;
    postalCode: string;
    country: string;
  };
  workHistory: {
    company: string;
    jobTitle: string;
    location: string;
    workingStyle: string;
    workingType: string;
    startDate: string;
    endDate: string;
    /** One bullet per line. */
    bullets: string;
  }[];
  education: { institution: string; degree: string; field: string; startDate: string; endDate: string }[];
  certifications: { name: string; issuer: string; issueDate: string }[];
  /** `skills` is comma- or newline-separated. */
  skills: { category: string; skills: string }[];
};

const required = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long (max ${max} characters)`);
const optional = (label: string, max = 200) =>
  z
    .string()
    .trim()
    .max(max, `${label} is too long (max ${max} characters)`)
    .transform((v) => v || null);
const optionalMonth = z
  .string()
  .trim()
  .refine((v) => v === "" || YEAR_MONTH.test(v), "Use a month and year")
  .transform((v) => v || null);
const lines = (value: string) =>
  value
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[•\-*>▪●◦–]\s*)?/, "").trim())
    .filter(Boolean);

const personalSchema = z.object({
  fullName: required("Full name", 120),
  contactEmail: z.string().trim().min(1, "Contact email is required").pipe(z.email("Enter a valid email address")),
  phone: required("Phone", 40),
  linkedinUrl: z
    .string()
    .trim()
    .refine((v) => v === "" || z.url().safeParse(v).success, "Enter a full URL, e.g. https://linkedin.com/in/…")
    .transform((v) => v || null),
  city: optional("City", 100),
  state: optional("State", 100),
  professionalSummary: optional("Summary", 3000),
  dateOfBirth: z
    .string()
    .trim()
    .refine((v) => v === "" || z.iso.date().safeParse(v).success, "Enter a valid date")
    .transform((v) => v || null),
  addressLine1: optional("Address line 1"),
  addressLine2: optional("Address line 2"),
  postalCode: optional("Postal code", 30),
  country: optional("Country", 100),
});

const workSchema = z
  .object({
    company: required("Company"),
    jobTitle: required("Job title"),
    location: optional("Location"),
    workingStyle: z.union([z.enum(WORKING_STYLES), z.literal("")]).transform((v) => v || null),
    workingType: z.union([z.enum(WORKING_TYPES), z.literal("")]).transform((v) => v || null),
    startDate: z.string().trim().regex(YEAR_MONTH, "Start date is required"),
    endDate: optionalMonth,
    bullets: z
      .string()
      .transform(lines)
      .pipe(
        z
          .array(z.string().max(1000, "A bullet is too long (max 1,000 characters)"))
          .min(1, "Add at least one bullet point")
          .max(40, "Too many bullets for one role (max 40)")
      ),
  })
  .refine((w) => !w.endDate || w.endDate >= w.startDate, {
    path: ["endDate"],
    message: "End date can't be before the start date",
  });

const educationSchema = z
  .object({
    institution: required("Institution"),
    degree: required("Degree"),
    field: optional("Field of study"),
    startDate: optionalMonth,
    endDate: optionalMonth,
  })
  .refine((e) => !e.startDate || !e.endDate || e.endDate >= e.startDate, {
    path: ["endDate"],
    message: "End date can't be before the start date",
  });

const certificationSchema = z.object({
  name: required("Certification name"),
  issuer: optional("Issuer"),
  issueDate: optionalMonth,
});

const skillGroupSchema = z.object({
  category: required("Category", 100),
  skills: z
    .string()
    .transform((v) =>
      v
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
    )
    .pipe(z.array(z.string().max(100, "A skill name is too long")).min(1, "Add at least one skill")),
});

export const reviewedProfileSchema = z
  .object({
    personal: personalSchema,
    workHistory: z.array(workSchema).min(1, "Add at least one role").max(30, "Too many roles (max 30)"),
    education: z.array(educationSchema).max(20),
    certifications: z.array(certificationSchema).max(50),
    skills: z.array(skillGroupSchema).max(40),
  })
  .superRefine((profile, ctx) => {
    const seen = new Map<string, number>();
    profile.skills.forEach((group, i) => {
      const key = group.category.toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({ code: "custom", path: ["skills", i, "category"], message: "This category is already used above" });
      } else {
        seen.set(key, i);
      }
    });
  });

export type ReviewedProfile = z.output<typeof reviewedProfileSchema>;

/** Field path ("workHistory.2.startDate") → message. The first issue per field wins. */
export type FieldErrors = Record<string, string>;

/** What the create/replace server actions return: nothing on success (or a redirect), else errors. */
export type ReviewSubmitResult = { error?: string; fieldErrors?: FieldErrors } | undefined;

/** The review form's full submission. */
export type ReviewSubmission = { profile: ReviewedProfileInput; sourceText: string; fileName: string | null };

export function validateReviewedProfile(
  input: ReviewedProfileInput
): { ok: true; data: ReviewedProfile } | { ok: false; fieldErrors: FieldErrors } {
  const result = reviewedProfileSchema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  const fieldErrors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join(".") || "_form";
    fieldErrors[path] ??= issue.message;
  }
  return { ok: false, fieldErrors };
}

const EMPTY_PERSONAL: ReviewedProfileInput["personal"] = {
  fullName: "",
  contactEmail: "",
  phone: "",
  linkedinUrl: "",
  city: "",
  state: "",
  professionalSummary: "",
  dateOfBirth: "",
  addressLine1: "",
  addressLine2: "",
  postalCode: "",
  country: "",
};

/** Prefills the review form from a parsed resume (contact details come from local extraction). */
export function draftToInput(draft: BaseResumeDraft, contact: ExtractedContact): ReviewedProfileInput {
  return {
    personal: {
      ...EMPTY_PERSONAL,
      fullName: draft.fullName,
      contactEmail: contact.email ?? "",
      phone: contact.phone ?? "",
      linkedinUrl: contact.linkedinUrl ?? "",
      city: draft.city ?? "",
      state: draft.state ?? "",
      professionalSummary: draft.summary,
    },
    workHistory: draft.workHistory.map((w) => ({
      company: w.company,
      jobTitle: w.jobTitle,
      location: w.location ?? "",
      workingStyle: w.workingStyle ?? "",
      workingType: w.workingType ?? "",
      startDate: w.startDate ?? "",
      endDate: w.endDate ?? "",
      bullets: w.bullets.join("\n"),
    })),
    education: draft.education.map((e) => ({
      institution: e.institution,
      degree: e.degree,
      field: e.field ?? "",
      startDate: e.startDate ?? "",
      endDate: e.endDate ?? "",
    })),
    certifications: draft.certifications.map((c) => ({
      name: c.name,
      issuer: c.issuer ?? "",
      issueDate: c.issueDate ?? "",
    })),
    skills: draft.skills.map((g) => ({ category: g.category, skills: g.skills.join(", ") })),
  };
}

export const EMPTY_WORK_ENTRY: ReviewedProfileInput["workHistory"][number] = {
  company: "",
  jobTitle: "",
  location: "",
  workingStyle: "",
  workingType: "",
  startDate: "",
  endDate: "",
  bullets: "",
};
export const EMPTY_EDUCATION_ENTRY: ReviewedProfileInput["education"][number] = {
  institution: "",
  degree: "",
  field: "",
  startDate: "",
  endDate: "",
};
export const EMPTY_CERTIFICATION_ENTRY: ReviewedProfileInput["certifications"][number] = {
  name: "",
  issuer: "",
  issueDate: "",
};
export const EMPTY_SKILL_GROUP: ReviewedProfileInput["skills"][number] = { category: "", skills: "" };
