import type OpenAI from "openai";
import { createDeepSeekClient, toFriendlyDeepSeekError, stripJsonFence, readUsage } from "@/lib/tailoring/deepseek";
import { baseResumeDraftSchema, type BaseResumeDraft } from "@/lib/base-resume/schema";
import { redactContact } from "@/lib/base-resume/text";

// Extraction, not writing: the fast model with thinking off is accurate here
// and returns in seconds. All tailoring happens later, with the resume prompt.
const PARSE_MODEL = "deepseek-flash";
const PARSE_TIMEOUT_MS = 110_000;
const PARSE_MAX_TOKENS = 16_000;

/**
 * Transcription rules for turning a resume into profile fields. The profile
 * becomes the "original resume" the generation prompt tailors from, so
 * anything lost or reworded here is lost from every generated resume — hence
 * the insistence on verbatim, complete copying.
 */
export const PARSE_INSTRUCTIONS = `You transcribe a resume's raw text into json, exactly as written. You are a copier, not an editor.

Rules:
- Copy every piece of text VERBATIM: same words, same order, same numbers. Never rewrite, summarize, shorten, merge, split, correct, or embellish.
- Include EVERY work-history role and EVERY bullet point under each role, in the order they appear. Remove only the leading bullet symbol (•, -, *, >, ▪, ●, ◦, –).
- If a role's duties are written as a paragraph instead of bullets, put each sentence in "bullets" as written.
- "summary" is the profile / summary / about / objective section text, verbatim ("" if there is none).
- Keep the resume's OWN skill categories and their order exactly as written (category name before the colon, skills split on commas). If skills are listed without categories, use one category named "Skills".
- Dates as "YYYY-MM". Month + year → that month; a year alone → "YYYY-01". "Present", "Current", "Now" → endDate null. A missing date → null. Never guess.
- "workingStyle": "FULL_TIME", "PART_TIME" or "CONTRACT" only when the resume states it for that role, else null. "workingType": "REMOTE", "HYBRID" or "ON_SITE" only when stated, else null.
- "location" is the role's location as written (e.g. "Springfield, IL, USA"), else null. "city"/"state" are the candidate's own location from the header, else null.
- Contact details are masked as [email] / [phone]; ignore them.
- Return ONLY this json shape:
{
  "fullName": "",
  "city": null,
  "state": null,
  "summary": "",
  "workHistory": [
    { "company": "", "jobTitle": "", "location": null, "workingStyle": null, "workingType": null, "startDate": "YYYY-MM", "endDate": null, "bullets": [""] }
  ],
  "education": [ { "institution": "", "degree": "", "field": null, "startDate": null, "endDate": null } ],
  "certifications": [ { "name": "", "issuer": null, "issueDate": null } ],
  "skills": [ { "category": "", "skills": [""] } ]
}`;

export class ResumeParseError extends Error {
  constructor(detail: string) {
    super(`Couldn't read the resume (${detail}). Try again, or paste the resume text instead.`);
  }
}

export type ParseBaseResumeResult = {
  draft: BaseResumeDraft;
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
};

/** Parses resume text into a profile draft. Email/phone are redacted before the text leaves the app. */
export async function parseBaseResume(sourceText: string): Promise<ParseBaseResumeResult> {
  const client = createDeepSeekClient(PARSE_TIMEOUT_MS);

  // `thinking` is a DeepSeek extension to the Chat Completions body; the SDK forwards it as-is.
  const params = {
    model: PARSE_MODEL,
    max_tokens: PARSE_MAX_TOKENS,
    temperature: 0,
    response_format: { type: "json_object" },
    thinking: { type: "disabled" },
    messages: [
      { role: "system", content: PARSE_INSTRUCTIONS },
      { role: "user", content: `RESUME TEXT:\n${redactContact(sourceText)}` },
    ],
  } as OpenAI.ChatCompletionCreateParamsNonStreaming;

  let inputTokens = 0;
  let cachedInputTokens = 0;
  let outputTokens = 0;
  let lastError: Error = new ResumeParseError("no response");

  // JSON mode can occasionally return empty content — allow one fresh attempt.
  for (let attempt = 1; attempt <= 2; attempt++) {
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

    const choice = completion.choices[0];
    if (choice?.finish_reason === "length") {
      lastError = new ResumeParseError("the resume is too long to read in one pass");
      continue;
    }

    const raw = stripJsonFence(choice?.message?.content ?? "");
    if (!raw) {
      lastError = new ResumeParseError("empty response");
      continue;
    }
    try {
      const draft = baseResumeDraftSchema.parse(JSON.parse(raw));
      return { draft, model: PARSE_MODEL, inputTokens, cachedInputTokens, outputTokens };
    } catch {
      lastError = new ResumeParseError("unexpected response format");
    }
  }

  throw lastError;
}
