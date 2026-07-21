"use server";

import { revalidatePath } from "next/cache";
import { requireResumePlatformAccess, requireSuperAdmin } from "@/lib/auth/require-user";
import { tailorResume, ProfileIncompleteError } from "@/lib/tailoring/tailor-resume";
import { ResumeNotFoundError, InvalidScreenshotError, uploadScreenshot } from "@/lib/resumes/resumes";
import { updateApplicationDetails } from "@/lib/admin/applications";
import { updateResumeDetailsSchema } from "@/lib/resumes/schemas";
import { RateLimitExceededError } from "@/lib/rate-limit";

export type GenerateState = { error?: string } | undefined;

export async function generateTailoredResumeAction(
  resumeId: string,
  _prevState: GenerateState,
  _formData: FormData
): Promise<GenerateState> {
  const user = await requireResumePlatformAccess();

  try {
    await tailorResume(user.id, resumeId);
  } catch (err) {
    if (err instanceof ProfileIncompleteError || err instanceof RateLimitExceededError) {
      return { error: err.message };
    }
    if (err instanceof ResumeNotFoundError) {
      return { error: "Resume not found" };
    }
    return { error: "Generation failed — try again in a moment" };
  }

  revalidatePath(`/resumes/${resumeId}`);
  revalidatePath("/dashboard");
}

export type DetailsActionState = { error?: string; success?: boolean } | undefined;

/** Source, follow-up date, and notes are superadmin-only — for any user's application, not just their own. */
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

export async function uploadScreenshotAction(
  resumeId: string,
  _prevState: ScreenshotActionState,
  formData: FormData
): Promise<ScreenshotActionState> {
  const user = await requireResumePlatformAccess();

  const file = formData.get("screenshot");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a screenshot image to upload" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await uploadScreenshot(user.id, resumeId, buffer, file.type);
  } catch (err) {
    if (err instanceof InvalidScreenshotError) return { error: err.message };
    if (err instanceof ResumeNotFoundError) return { error: err.message };
    throw err;
  }

  revalidatePath(`/resumes/${resumeId}`);
  revalidatePath("/resumes");
  return { success: true };
}
