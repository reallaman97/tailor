import type OpenAI from "openai";
import { z } from "zod";
import { createDeepSeekClient, toFriendlyDeepSeekError, extractJsonObject, readUsage } from "@/lib/tailoring/deepseek";
import { compactJobDescription } from "@/lib/job-description";
import { COVER_LETTER_INSTRUCTIONS, ASK_AI_INSTRUCTIONS, ANSWER_LENGTHS, type AnswerLength } from "@/lib/assist/prompts";

// Short, interactive outputs: the fast model with thinking on gives careful
// answers in seconds rather than the minute a full resume takes.
export const ASSIST_MODEL = "deepseek-flash";
const ASSIST_TIMEOUT_MS = 110_000;
// Short, grounded outputs don't need deep reasoning: A/B-tested on real
// questions, "low" used ~20% fewer output tokens than the default ("high")
// with equivalent answers (same facts, lengths, and year counts).
const ASSIST_REASONING_EFFORT = "low";
const ASSIST_MAX_TOKENS = 8_000;

export type AssistContext = {
  /** The submitted (tailored) resume as plain text, without email/phone — see resumeToText. */
  resumeText: string;
  companyName: string;
  jobTitle: string;
  jobDescription: string;
};

export type AssistUsage = { model: string; inputTokens: number; cachedInputTokens: number; outputTokens: number };

export class AssistOutputError extends Error {
  constructor() {
    super("The AI returned an unusable response. Try again.");
  }
}

/**
 * The application's context — identical for every request about it, and kept
 * at the START of the message on purpose: DeepSeek caches matching prompt
 * prefixes automatically, so every further question (and a regenerated cover
 * letter) on the same application is billed at the cache-hit price for all of
 * this. Anything that varies per request goes after it (see requestTail).
 */
function contextBlock(ctx: AssistContext): string {
  return [
    "SUBMITTED RESUME:",
    ctx.resumeText,
    "",
    "TARGET JOB:",
    `Company: ${ctx.companyName}`,
    `Title: ${ctx.jobTitle}`,
    "Description:",
    compactJobDescription(ctx.jobDescription),
  ].join("\n");
}

/** The per-request part, after the cacheable context. */
function requestTail(lines: string[]): string {
  return [
    // The model has no clock — without this, "years of experience" answers are
    // computed against its training date and come out years short.
    `TODAY'S DATE: ${new Date().toISOString().slice(0, 10)}`,
    ...lines,
  ].join("\n");
}

const ATTEMPTS = 3;

/**
 * One JSON reply from the model, robust to DeepSeek's known JSON-mode quirk of
 * occasionally returning empty (whitespace-only) content — observed several
 * times in a row on the same request. Retries, and makes the last attempt
 * without JSON mode (the prompt still asks for JSON), pulling the object out
 * of the plain reply.
 */
async function callJson<T>(system: string, user: string, schema: z.ZodType<T>): Promise<{ data: T; usage: AssistUsage }> {
  const client = createDeepSeekClient(ASSIST_TIMEOUT_MS);
  const base = {
    model: ASSIST_MODEL,
    max_tokens: ASSIST_MAX_TOKENS,
    thinking: { type: "enabled" },
    reasoning_effort: ASSIST_REASONING_EFFORT,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };

  let inputTokens = 0;
  let cachedInputTokens = 0;
  let outputTokens = 0;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const jsonMode = attempt < ATTEMPTS;
    const params = (jsonMode ? { ...base, response_format: { type: "json_object" } } : base) as OpenAI.ChatCompletionCreateParamsNonStreaming;
    let completion: OpenAI.ChatCompletion;
    try {
      completion = await client.chat.completions.create(params);
    } catch (err) {
      throw toFriendlyDeepSeekError(err);
    }
    const usage = readUsage(completion);
    inputTokens += usage.inputTokens;
    cachedInputTokens += usage.cachedInputTokens;
    outputTokens += usage.outputTokens;

    const raw = extractJsonObject(completion.choices[0]?.message?.content ?? "");
    try {
      const data = schema.parse(JSON.parse(raw));
      return { data, usage: { model: ASSIST_MODEL, inputTokens, cachedInputTokens, outputTokens } };
    } catch {
      // fall through to one more attempt
    }
  }
  throw new AssistOutputError();
}

const coverLetterSchema = z.object({ coverLetter: z.string().trim().min(40) });

export async function generateCoverLetter(
  ctx: AssistContext,
  extraInstructions: string
): Promise<{ coverLetter: string; usage: AssistUsage }> {
  const user = [contextBlock(ctx), "", requestTail(["EXTRA INSTRUCTIONS:", extraInstructions.trim() || "(none)"])].join("\n");
  const { data, usage } = await callJson(COVER_LETTER_INSTRUCTIONS, user, coverLetterSchema);
  return { coverLetter: normalizeParagraphs(data.coverLetter), usage };
}

const answerSchema = z.object({
  answer: z.string().trim().min(1),
  needsReview: z.boolean().catch(false),
  reviewNote: z.string().catch("").transform((v) => v.trim()),
});

export type DraftedAnswer = z.infer<typeof answerSchema>;

export async function answerApplicationQuestion(
  ctx: AssistContext,
  question: string,
  length: AnswerLength,
  charLimit: number | null
): Promise<{ answer: DraftedAnswer; usage: AssistUsage }> {
  const user = [
    contextBlock(ctx),
    "",
    requestTail([
      "QUESTION:",
      question.trim(),
      `ANSWER LENGTH: ${ANSWER_LENGTHS[length]}`,
      ...(charLimit ? [`CHARACTER LIMIT: ${charLimit} characters maximum, including spaces`] : []),
    ]),
  ].join("\n");

  const { data, usage } = await callJson(ASK_AI_INSTRUCTIONS, user, answerSchema);
  const answer = { ...data, answer: normalizeParagraphs(data.answer) };

  // The model is told the limit, but a form will hard-reject anything over it —
  // flag it rather than silently truncating mid-sentence.
  if (charLimit && answer.answer.length > charLimit) {
    answer.needsReview = true;
    answer.reviewNote = [answer.reviewNote, `Answer is ${answer.answer.length} characters — trim it to ${charLimit}.`]
      .filter(Boolean)
      .join(" ");
  }
  return { answer, usage };
}

/** Strips markdown emphasis the model sometimes adds and tidies paragraph spacing. */
function normalizeParagraphs(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
