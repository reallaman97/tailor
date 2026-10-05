import type OpenAI from "openai";
import { modelOutputSchema, type ModelOutput } from "@/lib/tailoring/schema";
import { getResumePrompt } from "@/lib/tailoring/resume-prompt";
import { createDeepSeekClient, toFriendlyDeepSeekError, extractJsonObject, readUsage } from "@/lib/tailoring/deepseek";
import { compactJobDescription } from "@/lib/job-description";
import type { ResumeFields } from "@/lib/profile/resume-fields";

export const TAILORING_PROMPT_VERSION = "deepseek-universal-v1";

// Generous: the reasoning pass alone can use several thousand tokens before
// the JSON answer starts, and a truncated answer is unusable.
const MAX_OUTPUT_TOKENS = 32_000;

// A thinking-mode generation typically takes 40–90s. Bound it well under the
// route's maxDuration (300s) so a hung call errors instead of being killed.
const REQUEST_TIMEOUT_MS = 240_000;

/**
 * How the app receives the model's answer. Sent as its OWN system message
 * after the secret prompt — the prompt itself is passed through untouched.
 * It only fixes the shape of "1. Updated resume 2. Short validation report" so
 * the result can be stored and rendered to PDF; it adds no writing guidance.
 *
 * The last sentence matters: without it, the JSON shape reads as "a
 * structured digest" and the model condensed resumes well below the prompt's
 * "close to the original length" (A/B-tested: ~74% → ~81% of the base
 * resume's bullet text retained, and far less run-to-run variance).
 */
export const OUTPUT_FORMAT_CONTRACT = `OUTPUT FORMAT (application contract — how this system receives your final output; it does not change the instructions above):
The user message contains CURRENT RESUME (JSON) and TARGET JOB DESCRIPTION.
Respond with ONE json object and nothing else, shaped exactly like:
{
  "resume": {
    "headline": "professional title line shown under the candidate's name",
    "summary": "professional summary",
    "experience": [
      { "entryId": "<exact id of the work-history entry>", "jobTitle": "title for this role", "bullets": ["...", "..."] }
    ],
    "skills": [ { "category": "Category name", "skills": ["Skill", "Skill"] } ],
    "certifications": ["exact certification names from the current resume, in display order"]
  },
  "validationReport": {
    "atsMatchScore": 0,
    "aiProbability": 0,
    "researchContributionCheck": "short text",
    "evidencePlacementCheck": "short text",
    "titleRealismCheck": "short text",
    "gapsAndRisks": ["short note", "short note"]
  }
}
Rules for this format: include exactly one "experience" item per work-history entry, using its exact "id" as "entryId". Company names, employment dates, locations, and education are rendered from the stored resume, so they are not returned. Bullets and summary are plain text (no markdown). "atsMatchScore" and "aiProbability" are integer percentage estimates (0-100).
The "resume" object is the complete updated resume — every role with all of its bullets as they appear in the updated resume, and the full Skills section — not an excerpt or summary.`;

export class InvalidModelOutputError extends Error {
  constructor(detail: string) {
    super(`The AI returned an unusable response (${detail}). Try again.`);
  }
}

export class GenerationStoppedError extends Error {
  constructor() {
    super("Generation stopped.");
  }
}

/**
 * The user message for a generation, plus the real work-history id behind
 * each short role id ("r1" → entryIds[0]).
 */
export function buildInput(resumeFields: ResumeFields, jobDescription: string): { text: string; entryIds: string[] } {
  // Only what the prompt works with, as compact JSON — every token here is
  // paid on every generation:
  // - No contact details (email, phone, LinkedIn, location): the header is
  //   rendered from the stored profile, and PII mustn't reach the provider.
  //   (DOB and street address never leave getResumeFields at all.)
  // - No name: nothing the model writes needs it.
  // - Short role ids ("r1", "r2", …) instead of 25-char database ids, mapped
  //   back in generateTailoredContent.
  // - Empty/null fields omitted; no pretty-printing.
  // - Roles newest first, so "latest role" is unambiguous.
  const roles = [...resumeFields.workHistory].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const resume = prune({
    summary: resumeFields.professionalSummary,
    experience: roles.map((w, i) => ({
      id: `r${i + 1}`,
      title: w.jobTitle,
      company: w.company,
      location: w.location,
      start: w.startDate,
      end: w.endDate ?? "Present",
      bullets: w.achievements,
    })),
    education: resumeFields.education.map((e) => ({
      degree: e.degree,
      field: e.field,
      institution: e.institution,
      start: e.startDate,
      end: e.endDate,
    })),
    certifications: resumeFields.certifications.map((c) => ({ name: c.name, issuer: c.issuer, date: c.issueDate })),
    skills: resumeFields.skills,
  });
  return {
    text: ["CURRENT RESUME (JSON):", JSON.stringify(resume), "", "TARGET JOB DESCRIPTION:", compactJobDescription(jobDescription)].join("\n"),
    entryIds: roles.map((w) => w.id),
  };
}

/** Drops null/undefined/empty-string values and empty arrays, recursively. */
function prune<T>(value: T): T {
  if (Array.isArray(value)) return value.map(prune).filter((v) => !isEmpty(v)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const pruned = prune(v);
      if (!isEmpty(pruned)) out[k] = pruned;
    }
    return out as T;
  }
  return value;
}

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
}

/** Parses the model's JSON answer; tolerates a ```json fence or text around the object. Throws InvalidModelOutputError. */
export function parseModelOutput(raw: string): ModelOutput {
  const text = extractJsonObject(raw);
  if (!text) throw new InvalidModelOutputError("empty response");

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new InvalidModelOutputError("not valid JSON");
  }

  const parsed = modelOutputSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new InvalidModelOutputError(`missing ${issue?.path.join(".") || "fields"}`);
  }
  return parsed.data;
}

export type TailoringResult = {
  output: ModelOutput;
  model: string;
  inputTokens: number;
  /** Input tokens served from DeepSeek's prefix cache (billed at a small fraction). */
  cachedInputTokens: number;
  /** Includes reasoning tokens (DeepSeek bills them as output). */
  outputTokens: number;
  reasoningTokens: number;
  latencyMs: number;
  /** The model's answer as returned — for the service-admin debug page. */
  rawJson: string;
};

export async function generateTailoredContent(
  resumeFields: ResumeFields,
  jobDescription: string,
  options: { model: string; /** Aborts the in-flight DeepSeek request (user stopped the build). */ signal?: AbortSignal }
): Promise<TailoringResult> {
  const systemPrompt = getResumePrompt();
  const client = createDeepSeekClient(REQUEST_TIMEOUT_MS);
  const start = Date.now();
  const input = buildInput(resumeFields, jobDescription);

  // The two system messages are identical on every call, so DeepSeek's
  // automatic prefix cache serves them at a small fraction of the input price
  // after the first generation — keep anything per-request out of them.
  // `thinking` is a DeepSeek extension to the Chat Completions body; the SDK
  // forwards it as-is.
  const base = {
    model: options.model,
    max_tokens: MAX_OUTPUT_TOKENS,
    thinking: { type: "enabled" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "system", content: OUTPUT_FORMAT_CONTRACT },
      { role: "user", content: input.text },
    ],
  };

  // DeepSeek's JSON mode occasionally returns empty content (sometimes twice in
  // a row), so the retry goes out WITHOUT JSON mode — the contract still asks
  // for JSON, and parseModelOutput pulls the object out of the plain reply.
  // That makes the one retry far more likely to land than repeating the mode
  // that just failed, so a whole expensive generation isn't wasted.
  let inputTokens = 0;
  let cachedInputTokens = 0;
  let outputTokens = 0;
  let reasoningTokens = 0;
  let lastError: Error = new InvalidModelOutputError("no response");

  for (let attempt = 1; attempt <= 2; attempt++) {
    const params = (attempt === 1 ? { ...base, response_format: { type: "json_object" } } : base) as OpenAI.ChatCompletionCreateParamsNonStreaming;
    let completion: OpenAI.ChatCompletion;
    try {
      completion = await client.chat.completions.create(params, { signal: options.signal });
    } catch (err) {
      if (options.signal?.aborted) throw new GenerationStoppedError();
      throw toFriendlyDeepSeekError(err);
    }

    const usage = readUsage(completion);
    inputTokens += usage.inputTokens;
    cachedInputTokens += usage.cachedInputTokens;
    outputTokens += usage.outputTokens;
    reasoningTokens += usage.reasoningTokens;

    const choice = completion.choices[0];
    if (choice?.finish_reason === "length") {
      lastError = new InvalidModelOutputError("the answer was cut off");
      continue;
    }

    const raw = choice?.message?.content ?? "";
    try {
      const output = parseModelOutput(raw);
      // Short role ids back to the real work-history ids (unknown ones are left
      // as-is and dropped by the sanitizer).
      for (const role of output.resume.experience) {
        const index = /^r(\d+)$/.exec(role.entryId)?.[1];
        const real = index ? input.entryIds[Number(index) - 1] : undefined;
        if (real) role.entryId = real;
      }
      return {
        output,
        model: options.model,
        inputTokens,
        cachedInputTokens,
        outputTokens,
        reasoningTokens,
        latencyMs: Date.now() - start,
        rawJson: raw,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new InvalidModelOutputError("unknown");
    }
  }

  throw lastError;
}
