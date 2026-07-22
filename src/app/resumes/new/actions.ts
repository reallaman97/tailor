"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireResumePlatformAccess } from "@/lib/auth/require-user";
import { createResumeSchema } from "@/lib/resumes/schemas";
import { createResume, DuplicateApplicationError } from "@/lib/resumes/resumes";
import { classifyRoleTrack } from "@/lib/resumes/classify-role-track";
import { tailorResume, ProfileIncompleteError } from "@/lib/tailoring/tailor-resume";
import { readResumeValues, type NewResumeState } from "./shared";

/**
 * A normal user applying for a job: status and source are always set
 * automatically (APPLIED / Job Board) — only a superadmin can change either
 * afterward. Role track is never taken from the client; it's AI-classified here.
 * The tailored resume is generated right here as part of "building" it.
 */
export async function createResumeAction(
  _prevState: NewResumeState,
  formData: FormData
): Promise<NewResumeState> {
  const user = await requireResumePlatformAccess();
  const values = readResumeValues(formData);

  const parsed = createResumeSchema.safeParse({
    jobLink: formData.get("jobLink"),
    companyName: formData.get("companyName"),
    jobTitle: formData.get("jobTitle"),
    jobDescription: formData.get("jobDescription"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input", values };
  }

  const roleTrack = await classifyRoleTrack(parsed.data.jobTitle, parsed.data.jobDescription);

  let resumeId: string;
  try {
    resumeId = await createResume(user.id, {
      ...parsed.data,
      roleTrack,
      source: "JOB_BOARD",
      status: "APPLIED",
    });
  } catch (err) {
    if (err instanceof DuplicateApplicationError) return { error: err.message, values };
    throw err;
  }

  // Build the tailored resume. If it fails, roll the application back out of the
  // tracker so a failed build records nothing — the user just fixes it and retries.
  try {
    await tailorResume(user.id, resumeId);
  } catch (err) {
    await db.resume.delete({ where: { id: resumeId } }).catch(() => {});
    if (err instanceof ProfileIncompleteError) {
      return { error: err.message, values };
    }
    console.error("Resume tailoring failed:", err);
    const detail = err instanceof Error ? err.message : "unknown error";
    return { error: `Tailoring failed: ${detail}`, values };
  }

  revalidatePath("/resumes");
  revalidatePath("/dashboard");
  return { resumeId };
}
