"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { tailorResume, ProfileIncompleteError } from "@/lib/tailoring/tailor-resume";
import { ResumeNotFoundError } from "@/lib/resumes/resumes";
import { RateLimitExceededError } from "@/lib/tailoring/usage";

export type GenerateState = { error?: string } | undefined;

export async function generateTailoredResumeAction(
  resumeId: string,
  _prevState: GenerateState,
  _formData: FormData
): Promise<GenerateState> {
  const user = await requireUser();

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
