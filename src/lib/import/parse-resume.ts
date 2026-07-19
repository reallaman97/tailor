import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { resumeDraftSchema, type ResumeDraft } from "@/lib/import/schema";

let cachedClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!cachedClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY environment variable is not set");
    cachedClient = new OpenAI({ apiKey });
  }
  return cachedClient;
}

// Reviewed prompt — see PHASE-3 notes for design rationale (accuracy over
// completeness: the model must never invent resume content).
export const RESUME_PARSE_SYSTEM_PROMPT = `You extract structured resume data from raw resume text.

Rules:
- Only extract information that is explicitly present in the text. Never invent, guess, or embellish employment history, dates, companies, titles, or education.
- If a field isn't present in the text, use null (or an empty array for lists) rather than fabricating a value.
- Dates must be formatted as YYYY-MM-DD. If only a month and year are given, use the first day of that month. If a role or degree is current/ongoing, set endDate to null.
- Preserve the original wording of achievement bullets as closely as possible; do not add invented metrics or outcomes that aren't in the source text.
- Group skills into languages, frameworks, tools, and soft skills based on context. If a skill doesn't clearly fit one of those, put it under tools.`;

export type ParseResumeResult = {
  draft: ResumeDraft;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

export async function parseResumeText(resumeText: string): Promise<ParseResumeResult> {
  const client = getClient();
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

  const response = await client.responses.parse({
    model,
    instructions: RESUME_PARSE_SYSTEM_PROMPT,
    input: resumeText,
    text: { format: zodTextFormat(resumeDraftSchema, "resume_draft") },
  });

  if (!response.output_parsed) {
    throw new Error("The model did not return structured resume data. Try again.");
  }

  return {
    draft: response.output_parsed,
    model,
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  };
}
