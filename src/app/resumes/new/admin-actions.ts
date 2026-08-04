"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { createResumeSchema, applicationSourceSchema } from "@/lib/resumes/schemas";
import { createResume, DuplicateApplicationError } from "@/lib/resumes/resumes";
import { classifyRoleTrack } from "@/lib/resumes/classify-role-track";
import { tailorResume, ProfileIncompleteError } from "@/lib/tailoring/tailor-resume";
import { readResumeValues, type NewResumeState, type NewResumeValues } from "./shared";

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
  const values = readResumeValues(formData);

  const profileId = formData.get("profileId");
  if (typeof profileId !== "string" || profileId.trim() === "") {
    return { error: "Select a profile to build this resume for", values };
  }

  const sourceParsed = applicationSourceSchema.safeParse(formData.get("source"));
  if (!sourceParsed.success) {
    return { error: "Select a source", values };
  }

  const parsed = createResumeSchema.safeParse({
    jobLink: formData.get("jobLink"),
    companyName: formData.get("companyName"),
    jobTitle: formData.get("jobTitle"),
    jobDescription: formData.get("jobDescription"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input", values };
  }

  const targetUser = await db.user.findFirst({
    where: { profileId },
    orderBy: { email: "asc" },
    select: { id: true },
  });
  if (!targetUser) {
    return { error: "That profile has no assigned account to build for", values };
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
    if (err instanceof DuplicateApplicationError)
      return { error: err.message, values, duplicateId: err.existing.id };
    throw err;
  }

  // Build the tailored resume for the profile's account right away.
  return tailorAndFinish(targetUser.id, resumeId, values);
}

/** Tailors a just-created application; on failure rolls it back so nothing is recorded. */
async function tailorAndFinish(
  ownerUserId: string,
  resumeId: string,
  values: NewResumeValues
): Promise<NewResumeState> {
  try {
    await tailorResume(ownerUserId, resumeId);
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
