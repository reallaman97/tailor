"use server";

import { revalidatePath } from "next/cache";
import { requireResumePlatformAccess, requireSuperAdmin } from "@/lib/auth/require-user";
import { ResumeNotFoundError, markProofSubmitted } from "@/lib/resumes/resumes";
import { updateApplicationDetails } from "@/lib/admin/applications";
import { updateResumeDetailsSchema } from "@/lib/resumes/schemas";

export type DetailsActionState = { error?: string; success?: boolean } | undefined;

/** Source and notes are superadmin-only — for any user's application, not just their own. */
export async function updateResumeDetailsAction(
  resumeId: string,
  _prevState: DetailsActionState,
  formData: FormData
): Promise<DetailsActionState> {
  await requireSuperAdmin();

  const parsed = updateResumeDetailsSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await updateApplicationDetails(resumeId, parsed.data);
  } catch {
    return { error: "Resume not found" };
  }

  revalidatePath(`/resumes/${resumeId}`);
  revalidatePath("/resumes");
  revalidatePath("/dashboard");
  return { success: true };
}

export type ScreenshotActionState = { error?: string; success?: boolean } | undefined;

/**
 * "Upload screenshot": records that proof was submitted. The uploader never
 * sends the image (see markProofSubmitted) — only this call is made.
 */
export async function markProofSubmittedAction(resumeId: string): Promise<ScreenshotActionState> {
  const user = await requireResumePlatformAccess();
  try {
    await markProofSubmitted(user.id, resumeId);
  } catch (err) {
    if (err instanceof ResumeNotFoundError) return { error: err.message };
    throw err;
  }
  revalidatePath(`/resumes/${resumeId}`);
  revalidatePath("/resumes");
  return { success: true };
}
