"use server";

import { requireResumePlatformAccess } from "@/lib/auth/require-user";
import { createResumeSchema } from "@/lib/resumes/schemas";
import { createResume, DuplicateApplicationError } from "@/lib/resumes/resumes";
import type { CreateApplicationResult } from "./shared";

/**
 * A normal user applying for a job: status and source are always set
 * automatically (APPLIED / Job Board) — only a superadmin can change either
 * afterward. Role track is never taken from the client; it's AI-classified
 * during the build. Creates the application only (duplicate check first, so a
 * duplicate costs nothing); the page then builds it via /api/resumes/[id]/build.
 */
export async function createResumeAction(formData: FormData): Promise<CreateApplicationResult> {
  const user = await requireResumePlatformAccess();

  const parsed = createResumeSchema.safeParse({
    jobLink: formData.get("jobLink"),
    companyName: formData.get("companyName"),
    jobTitle: formData.get("jobTitle"),
    jobDescription: formData.get("jobDescription"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    const createdId = await createResume(user.id, {
      ...parsed.data,
      roleTrack: "OTHER", // classified during the build
      source: "JOB_BOARD",
      status: "APPLIED",
    });
    return { createdId };
  } catch (err) {
    if (err instanceof DuplicateApplicationError) return { error: err.message, duplicateId: err.existing.id };
    throw err;
  }
}
