import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { tailoredContentSchema, type TailoredContent } from "@/lib/tailoring/schema";
import type { ResumeFields } from "@/lib/profile/resume-fields";

export const TAILORING_PROMPT_VERSION = "tailoring-v1";

let cachedClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!cachedClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY environment variable is not set");
    cachedClient = new OpenAI({ apiKey });
  }
  return cachedClient;
}

// Reviewed prompt — grounded rewriting, not generation. The model may only
// rephrase/reorder/select from what's already in the candidate's real
// profile; it must never invent experience, skills, or metrics.
export const TAILORING_SYSTEM_PROMPT = `You are a resume-tailoring assistant. You rewrite a candidate's existing resume content to better match a specific job description. You do not invent new experience.

You will be given, as JSON, the candidate's real profile — contact info, a professional summary, work history (each entry has a stable "id"), education, and a skill list grouped into languages/frameworks/tools/soft skills — followed by the full text of a job posting.

Your task:
- Write a new 2-4 sentence professional summary tailored to this job, grounded strictly in the candidate's real background. Do not claim skills, experience, or years of experience that aren't evidenced in the provided profile.
- For each work history entry, rewrite its achievement bullets to emphasize what's most relevant to the job description, using terminology and phrasing that aligns with the posting where it's honestly applicable. You may rephrase, reorder, tighten, and better quantify claims that are already present. You may NOT invent new metrics, responsibilities, tools, or outcomes that are not supported by the original bullets. Return one entry per work history item you were given, and every entry's "entryId" must exactly match the "id" given in the input.
- From the candidate's skill list, select and reorder the skills most relevant to this job. Do not add any skill that is not already present in the provided list.
- If the profile doesn't support a strong tailored angle for something, keep it modest and accurate rather than embellishing.`;

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
  jobDescription: string
): Promise<TailoringResult> {
  const client = getClient();
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

  const response = await client.responses.parse({
    model,
    instructions: TAILORING_SYSTEM_PROMPT,
    input: buildInput(resumeFields, jobDescription),
    text: { format: zodTextFormat(tailoredContentSchema, "tailored_content") },
  });

  if (!response.output_parsed) {
    throw new Error("The model did not return structured tailoring output. Try again.");
  }

  return {
    content: response.output_parsed,
    model,
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  };
}
