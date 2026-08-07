import OpenAI, { APIError } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { tailoredContentSchema, type TailoredContent } from "@/lib/tailoring/schema";
import { getOpenAiApiKey } from "@/lib/settings";
import type { ResumeFields } from "@/lib/profile/resume-fields";

export const TAILORING_PROMPT_VERSION = "tailoring-v2";

// Not cached: the key can change at runtime (a superadmin editing it in
// Settings), and constructing a client is cheap — no network call happens
// until a request is actually made. maxRetries is low so a doomed request
// (e.g. an out-of-quota 429) fails quickly instead of retrying for ~a minute.
// An explicit timeout bounds a hung/slow call so it errors well before the
// serverless function limit rather than holding the request open indefinitely
// (the SDK default is 10 minutes).
async function getClient(teamId?: string | null): Promise<OpenAI> {
  const apiKey = await getOpenAiApiKey(teamId);
  return new OpenAI({ apiKey, maxRetries: 1, timeout: 100_000 });
}

/** Maps raw OpenAI SDK errors to a clear, user-facing message. */
function toFriendlyOpenAiError(err: unknown): Error {
  if (err instanceof APIError) {
    if (err.code === "insufficient_quota") {
      return new Error(
        "OpenAI quota exceeded — the account is out of credits. Add billing/credits at platform.openai.com."
      );
    }
    if (err.status === 429) return new Error("OpenAI is rate-limiting requests right now — try again in a moment.");
    if (err.status === 401) return new Error("OpenAI rejected the API key — check it in Settings.");
    return new Error(`OpenAI error (${err.status}): ${err.message}`);
  }
  return err instanceof Error ? err : new Error("Tailoring failed — try again.");
}

export function buildInput(resumeFields: ResumeFields, jobDescription: string): string {
  // Contact PII (email, phone) is never used in tailored output — the model
  // only produces the summary, work-history bullets, and ordered skills — so
  // it must not be shipped to the LLM provider. Street address and DOB are
  // already excluded upstream (getResumeFields never reads them).
  const { contactEmail: _contactEmail, phone: _phone, ...modelFields } = resumeFields;
  return [
    "CANDIDATE PROFILE (JSON):",
    JSON.stringify(modelFields, null, 2),
    "",
    "JOB DESCRIPTION:",
    jobDescription,
  ].join("\n");
}

export type TailoringResult = {
  content: TailoredContent;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

export async function generateTailoredContent(
  resumeFields: ResumeFields,
  jobDescription: string,
  options: { model: string; systemPrompt: string; teamId?: string | null }
): Promise<TailoringResult> {
  const client = await getClient(options.teamId);

  let response;
  try {
    response = await client.responses.parse({
      model: options.model,
      instructions: options.systemPrompt,
      input: buildInput(resumeFields, jobDescription),
      text: { format: zodTextFormat(tailoredContentSchema, "tailored_content") },
    });
  } catch (err) {
    throw toFriendlyOpenAiError(err);
  }

  if (!response.output_parsed) {
    throw new Error("The model did not return structured tailoring output. Try again.");
  }

  return {
    content: response.output_parsed,
    model: options.model,
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  };
}
