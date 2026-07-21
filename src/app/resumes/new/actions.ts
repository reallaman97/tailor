"use server";

import { redirect } from "next/navigation";
import { requireResumePlatformAccess } from "@/lib/auth/require-user";
import { createResumeSchema } from "@/lib/resumes/schemas";
import { createResume, DuplicateApplicationError } from "@/lib/resumes/resumes";
import { classifyRoleTrack } from "@/lib/resumes/classify-role-track";

export type NewResumeState = { error?: string } | undefined;

/**
 * A normal user applying for a job: status and source are always set
 * automatically (APPLIED / Job Board) — only a superadmin can change either
 * afterward. Role track is never taken from the client; it's AI-classified here.
 */
export async function createResumeAction(
  _prevState: NewResumeState,
  formData: FormData
): Promise<NewResumeState> {
  const user = await requireResumePlatformAccess();

  const parsed = createResumeSchema.safeParse({
    jobLink: formData.get("jobLink"),
    companyName: formData.get("companyName"),
    jobTitle: formData.get("jobTitle"),
    jobDescription: formData.get("jobDescription"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
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
    if (err instanceof DuplicateApplicationError) return { error: err.message };
    throw err;
  }

  // Proof-of-application upload is prompted after building the resume, not here
  // at creation — see generateTailoredResumeAction.
  redirect(`/resumes/${resumeId}`);
}
