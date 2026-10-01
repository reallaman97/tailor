"use server";

import { z } from "zod";
import { requireResumePlatformAccess } from "@/lib/auth/require-user";
import { ResumeNotFoundError } from "@/lib/resumes/resumes";
import { generateCoverLetter, answerApplicationQuestion } from "@/lib/assist/generate";
import {
  loadAssistContext,
  saveCoverLetter,
  addAnswer,
  deleteAnswer,
  findSavedAnswer,
  AssistUnavailableError,
  type SavedAnswer,
} from "@/lib/assist/store";
import { ANSWER_LENGTHS, type AnswerLength } from "@/lib/assist/prompts";
import { recordUsageEvent } from "@/lib/tailoring/usage";

// Available to anyone who can open the application (bidders in its profile
// scope, team admins for any) — the same rule as the detail page itself.

/** Turns expected failures into a message for the form; anything else is a real bug and rethrows. */
function expectedError(err: unknown): string {
  if (err instanceof ResumeNotFoundError) return "This application no longer exists or you can't access it.";
  if (err instanceof AssistUnavailableError) return err.message;
  // DeepSeek errors are already mapped to clear, user-facing messages.
  if (err instanceof Error) return err.message;
  throw err;
}

export type CoverLetterResult = { coverLetter?: string; generatedAt?: string; error?: string };

export async function generateCoverLetterAction(resumeId: string, extraInstructions: string): Promise<CoverLetterResult> {
  const user = await requireResumePlatformAccess();
  const instructions = extraInstructions.trim().slice(0, 1000);
  try {
    const loaded = await loadAssistContext(user, resumeId);
    const { coverLetter, usage } = await generateCoverLetter(loaded.ctx, instructions);
    const generatedAt = await saveCoverLetter(loaded, coverLetter);
    await recordUsageEvent({ userId: user.id, resumeId, kind: "cover-letter", ...usage }).catch(() => {});
    return { coverLetter, generatedAt: generatedAt.toISOString() };
  } catch (err) {
    return { error: expectedError(err) };
  }
}

const questionSchema = z.object({
  question: z
    .string()
    .trim()
    .min(5, "Type the question from the application form")
    .max(2000, "That question is too long (max 2,000 characters)"),
  length: z.enum(Object.keys(ANSWER_LENGTHS) as [AnswerLength, ...AnswerLength[]]),
  charLimit: z
    .number()
    .int()
    .min(50, "A character limit under 50 is too short to answer in")
    .max(10000, "Character limit is too high")
    .nullable(),
});

/** `reused`: the same question was already answered here — the saved answer is returned, no AI call made. */
export type AskQuestionResult = { answer?: SavedAnswer; reused?: boolean; error?: string };

export async function askQuestionAction(
  resumeId: string,
  input: { question: string; length: AnswerLength; charLimit: number | null }
): Promise<AskQuestionResult> {
  const user = await requireResumePlatformAccess();
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid question" };
  const { question, length, charLimit } = parsed.data;

  try {
    const loaded = await loadAssistContext(user, resumeId);
    const existing = await findSavedAnswer(loaded, question, length, charLimit);
    if (existing) return { answer: existing, reused: true };

    const { answer, usage } = await answerApplicationQuestion(loaded.ctx, question, length, charLimit);
    const saved = await addAnswer(loaded, {
      question,
      answer: answer.answer,
      length,
      charLimit,
      needsReview: answer.needsReview,
      reviewNote: answer.reviewNote,
      createdById: user.id,
    });
    await recordUsageEvent({ userId: user.id, resumeId, kind: "ask-ai", ...usage }).catch(() => {});
    return { answer: saved };
  } catch (err) {
    return { error: expectedError(err) };
  }
}

export async function deleteAnswerAction(resumeId: string, answerId: string): Promise<{ error?: string }> {
  const user = await requireResumePlatformAccess();
  try {
    await deleteAnswer(user, resumeId, answerId);
    return {};
  } catch (err) {
    return { error: expectedError(err) };
  }
}
