import { z } from "zod";
import { ResumeNotFoundError } from "@/lib/resumes/resumes";
import { generateCoverLetter, answerApplicationQuestion } from "@/lib/assist/generate";
import {
  loadAssistContext,
  saveCoverLetter,
  addAnswer,
  findSavedAnswer,
  AssistUnavailableError,
  type SavedAnswer,
} from "@/lib/assist/store";
import { ANSWER_LENGTHS, type AnswerLength } from "@/lib/assist/prompts";
import { recordUsageEvent } from "@/lib/tailoring/usage";

// The AI side of the workstation's cover letter and Ask AI. Served from route
// handlers rather than server actions: Next.js runs a client's server actions
// one at a time, so a slow AI call would hold up every other action on the
// page (e.g. the proof screenshot upload) until it finished.

type Viewer = { id: string; role: string };

/** Turns expected failures into a message for the form; anything else is a real bug and rethrows. */
export function expectedAssistError(err: unknown): string {
  if (err instanceof ResumeNotFoundError) return "This application no longer exists or you can't access it.";
  if (err instanceof AssistUnavailableError) return err.message;
  // DeepSeek errors are already mapped to clear, user-facing messages.
  if (err instanceof Error) return err.message;
  throw err;
}

export type CoverLetterResult = { coverLetter?: string; generatedAt?: string; error?: string };

export async function runCoverLetter(user: Viewer, resumeId: string, extraInstructions: string): Promise<CoverLetterResult> {
  const instructions = extraInstructions.trim().slice(0, 1000);
  try {
    const loaded = await loadAssistContext(user, resumeId);
    const { coverLetter, usage } = await generateCoverLetter(loaded.ctx, instructions);
    const generatedAt = await saveCoverLetter(loaded, coverLetter);
    await recordUsageEvent({ userId: user.id, resumeId, kind: "cover-letter", ...usage }).catch(() => {});
    return { coverLetter, generatedAt: generatedAt.toISOString() };
  } catch (err) {
    return { error: expectedAssistError(err) };
  }
}

export const questionSchema = z.object({
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

export async function runAskQuestion(user: Viewer, resumeId: string, input: unknown): Promise<AskQuestionResult> {
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
    return { error: expectedAssistError(err) };
  }
}
