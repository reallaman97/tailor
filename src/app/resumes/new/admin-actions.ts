"use server";

import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { createResumeSchema, applicationSourceSchema } from "@/lib/resumes/schemas";
import { createResume, DuplicateApplicationError } from "@/lib/resumes/resumes";
import { classifyRoleTrack } from "@/lib/resumes/classify-role-track";
import type { NewResumeState } from "./actions";

/**
 * A superadmin building on behalf of a candidate: they pick which profile to
 * tailor for (not a specific user account — several accounts can share one
 * profile), and choose the source explicitly rather than it defaulting to
 * Job Board. The resulting application is attributed to that profile's
 * earliest-registered assigned account, so it shows up in the shared
 * tracker rather than the superadmin's own.
 */
export async function createResumeAsAdminAction(
  _prevState: NewResumeState,
  formData: FormData
): Promise<NewResumeState> {
  await requireSuperAdmin();

  const profileId = formData.get("profileId");
  if (typeof profileId !== "string" || profileId.trim() === "") {
    return { error: "Select a profile to build this resume for" };
  }

  const sourceParsed = applicationSourceSchema.safeParse(formData.get("source"));
  if (!sourceParsed.success) {
    return { error: "Select a source" };
  }

  const parsed = createResumeSchema.safeParse({
    jobLink: formData.get("jobLink"),
    companyName: formData.get("companyName"),
    jobTitle: formData.get("jobTitle"),
    jobDescription: formData.get("jobDescription"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const targetUser = await db.user.findFirst({
    where: { profileId },
    orderBy: { email: "asc" },
    select: { id: true },
  });
  if (!targetUser) {
    return { error: "That profile has no assigned account to build for" };
  }

  const roleTrack = await classifyRoleTrack(parsed.data.jobTitle, parsed.data.jobDescription);

  let resumeId: string;
  try {
    resumeId = await createResume(targetUser.id, {
      ...parsed.data,
      roleTrack,
      source: sourceParsed.data,
      status: "APPLIED",
    });
  } catch (err) {
    if (err instanceof DuplicateApplicationError) return { error: err.message };
    throw err;
  }

  redirect(`/resumes/${resumeId}`);
}
