"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/require-user";
import { requireTeamAdmin } from "@/lib/auth/team-context";
import { deleteProfile, assignProfileToUser, unassignUser } from "@/lib/admin/profiles";
import { createProfileFromReviewedResume, InvalidBaseResumeError } from "@/lib/base-resume/apply";
import {
  validateReviewedProfile,
  type ReviewSubmission,
  type ReviewSubmitResult,
} from "@/lib/base-resume/reviewed-profile";

/**
 * Creates a profile from its base resume — the only way to create one. The
 * admin uploaded the resume, we parsed it into the review form, and they
 * confirmed/corrected every section; the whole submission is validated here
 * with the same rules the form uses, field by field.
 */
export async function createProfileFromResumeAction(submission: ReviewSubmission): Promise<ReviewSubmitResult> {
  const ctx = await requireTeamAdmin();
  const validated = validateReviewedProfile(submission.profile);
  if (!validated.ok) return { error: "Fix the highlighted fields.", fieldErrors: validated.fieldErrors };

  let profileId: string;
  try {
    profileId = await createProfileFromReviewedResume(
      validated.data,
      { sourceText: submission.sourceText, fileName: submission.fileName },
      ctx.activeTeamId ?? null
    );
  } catch (err) {
    if (err instanceof InvalidBaseResumeError) return { error: err.message };
    throw err;
  }
  revalidatePath("/admin/profiles");
  redirect(`/admin/profiles/${profileId}?created=1`);
}

export async function deleteProfileAction(profileId: string): Promise<void> {
  await requireSuperAdmin();
  await deleteProfile(profileId);
  revalidatePath("/admin/profiles");
  revalidatePath("/admin/users");
}

/** Adds another account to this profile — a profile may be shared by any number of accounts. */
export async function addUserToProfileAction(profileId: string, formData: FormData): Promise<void> {
  await requireSuperAdmin();

  const raw = formData.get("userId");
  const userId = typeof raw === "string" && raw.length > 0 ? raw : null;
  if (userId) await assignProfileToUser(profileId, userId);

  revalidatePath(`/admin/profiles/${profileId}`);
  revalidatePath("/admin/profiles");
  revalidatePath("/admin/users");
}

export async function removeUserFromProfileAction(profileId: string, userId: string): Promise<void> {
  await requireSuperAdmin();
  await unassignUser(userId);

  revalidatePath(`/admin/profiles/${profileId}`);
  revalidatePath("/admin/profiles");
  revalidatePath("/admin/users");
}
