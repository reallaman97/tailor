import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { tailoredContentSchema, type TailoredContent } from "@/lib/tailoring/schema";
import { getOpenAiApiKey } from "@/lib/settings";
import type { ResumeFields } from "@/lib/profile/resume-fields";

export const TAILORING_PROMPT_VERSION = "tailoring-v1";

// Not cached: the key can change at runtime (a superadmin editing it in
// Settings), and constructing a client is cheap — no network call happens
// until a request is actually made.
async function getClient(): Promise<OpenAI> {
  const apiKey = await getOpenAiApiKey();
  return new OpenAI({ apiKey });
}

function buildInput(resumeFields: ResumeFields, jobDescription: string): string {
  return [
    "CANDIDATE PROFILE (JSON):",
    JSON.stringify(resumeFields, null, 2),
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
  options: { model: string; systemPrompt: string }
): Promise<TailoringResult> {
  const client = await getClient();

  const response = await client.responses.parse({
    model: options.model,
    instructions: options.systemPrompt,
    input: buildInput(resumeFields, jobDescription),
    text: { format: zodTextFormat(tailoredContentSchema, "tailored_content") },
  });

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
