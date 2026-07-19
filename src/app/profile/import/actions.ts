"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import {
  extractTextFromFile,
  UnsupportedFileTypeError,
  PDF_MIME_TYPE,
  DOCX_MIME_TYPE,
} from "@/lib/import/extract-text";
import { parseResumeText } from "@/lib/import/parse-resume";
import type { ResumeDraft } from "@/lib/import/schema";
import { savePersonalInfo } from "@/lib/profile/personal-info";
import { createWorkHistoryEntry } from "@/lib/profile/work-history";
import { createEducationEntry } from "@/lib/profile/education";
import { saveSkillGroup } from "@/lib/profile/skills";
import {
  personalInfoSchema,
  workHistoryEntrySchema,
  educationEntrySchema,
} from "@/lib/profile/schemas";
import type { SkillCategory } from "@/generated/prisma/client";
import { assertUnderDailyLimit, recordUsageEvent, RateLimitExceededError } from "@/lib/tailoring/usage";

const MAX_FILE_BYTES = 4.5 * 1024 * 1024; // leaves headroom under the 5mb server action body limit
const IMPORT_DAILY_LIMIT = 10;

export type ImportState = { error?: string; draft?: ResumeDraft } | undefined;

export async function importResumeAction(
  _prevState: ImportState,
  formData: FormData
): Promise<ImportState> {
  const user = await requireUser();

  try {
    await assertUnderDailyLimit(user.id, "resume_import", IMPORT_DAILY_LIMIT);
  } catch (err) {
    if (err instanceof RateLimitExceededError) return { error: err.message };
    throw err;
  }

  const file = formData.get("resume");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a PDF or DOCX file to upload" };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { error: "File is too large (max 4.5MB)" };
  }
  if (file.type !== PDF_MIME_TYPE && file.type !== DOCX_MIME_TYPE) {
    return { error: "Unsupported file type — upload a PDF or DOCX" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let text: string;
  try {
    text = await extractTextFromFile(buffer, file.type);
  } catch (err) {
    if (err instanceof UnsupportedFileTypeError) return { error: err.message };
    return { error: "Couldn't read that file — is it a valid PDF or DOCX?" };
  }

  if (text.trim().length < 20) {
    return { error: "Couldn't find enough text in that file to parse" };
  }

  try {
    const result = await parseResumeText(text);
    await recordUsageEvent({
      userId: user.id,
      kind: "resume_import",
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });
    return { draft: result.draft };
  } catch {
    return { error: "The resume parser failed — try again in a moment" };
  }
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}

const SKILL_CATEGORIES: Array<{ key: keyof ResumeDraft["skills"]; category: SkillCategory }> = [
  { key: "languages", category: "LANGUAGES" },
  { key: "frameworks", category: "FRAMEWORKS" },
  { key: "tools", category: "TOOLS" },
  { key: "softSkills", category: "SOFT_SKILLS" },
];

export type ConfirmImportState = { error?: string } | undefined;

/**
 * Persists an (already user-reviewed and possibly edited) draft. Runs every
 * field back through the same validation the normal profile forms use —
 * this data originated from an LLM and passed through the client, so it's
 * never trusted as pre-validated just because we generated it upstream.
 */
export async function confirmImportAction(draft: ResumeDraft): Promise<ConfirmImportState> {
  const user = await requireUser();

  const personalInfoResult = personalInfoSchema.safeParse({
    fullName: draft.personalInfo.fullName,
    contactEmail: draft.personalInfo.contactEmail ?? "",
    phone: draft.personalInfo.phone ?? "",
    linkedinUrl: draft.personalInfo.linkedinUrl ?? "",
    professionalSummary: draft.personalInfo.professionalSummary ?? "",
    city: draft.personalInfo.city ?? "",
    state: draft.personalInfo.state ?? "",
    dateOfBirth: "",
    addressLine1: "",
    addressLine2: "",
    postalCode: "",
    country: "",
  });
  if (!personalInfoResult.success) {
    return { error: `Personal info — ${firstIssue(personalInfoResult.error)}` };
  }
  await savePersonalInfo(user.id, personalInfoResult.data);

  // Sequential, not parallel: createWorkHistoryEntry/createEducationEntry
  // each compute the next sortOrder from the current row count, so
  // concurrent calls would race and produce duplicate values.
  for (const entry of draft.workHistory) {
    const parsed = workHistoryEntrySchema.safeParse({
      company: entry.company,
      jobTitle: entry.jobTitle,
      location: entry.location ?? "",
      startDate: entry.startDate ?? "",
      endDate: entry.endDate ?? "",
      achievements: entry.achievements.join("\n"),
    });
    if (!parsed.success) {
      return { error: `Work history "${entry.company}" — ${firstIssue(parsed.error)}` };
    }
    await createWorkHistoryEntry(user.id, parsed.data);
  }

  for (const entry of draft.education) {
    const parsed = educationEntrySchema.safeParse({
      institution: entry.institution,
      degree: entry.degree,
      field: entry.field ?? "",
      startDate: entry.startDate ?? "",
      endDate: entry.endDate ?? "",
    });
    if (!parsed.success) {
      return { error: `Education "${entry.institution}" — ${firstIssue(parsed.error)}` };
    }
    await createEducationEntry(user.id, parsed.data);
  }

  for (const { key, category } of SKILL_CATEGORIES) {
    const skills = draft.skills[key].map((s) => s.trim()).filter(Boolean);
    if (skills.length === 0) continue;
    await saveSkillGroup(user.id, { category, skills });
  }

  revalidatePath("/profile");
  redirect("/profile");
}
