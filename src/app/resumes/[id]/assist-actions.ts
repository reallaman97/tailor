"use server";

import { requireResumePlatformAccess } from "@/lib/auth/require-user";
import { deleteAnswer } from "@/lib/assist/store";
import { expectedAssistError } from "@/lib/assist/service";

// Generating a cover letter or an answer goes through /api/resumes/[id]/assist/*
// instead — see src/lib/assist/service.ts for why.

export async function deleteAnswerAction(resumeId: string, answerId: string): Promise<{ error?: string }> {
  const user = await requireResumePlatformAccess();
  try {
    await deleteAnswer(user, resumeId, answerId);
    return {};
  } catch (err) {
    return { error: expectedAssistError(err) };
  }
}
