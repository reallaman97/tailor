import OpenAI, { APIError } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { tailoredContentSchema, type TailoredContent } from "@/lib/tailoring/schema";
import { buildInput } from "@/lib/tailoring/generate";
import { getOpenAiApiKey } from "@/lib/settings";
import type { ResumeFields } from "@/lib/profile/resume-fields";

/**
 * Service-admin tailoring playground. Runs the exact tailoring call the app uses
 * (same input builder + structured-output schema) but returns the full detail —
 * parsed content, raw JSON, token usage, model, and latency — so a prompt/model
 * can be tested and its OpenAI response inspected. The candidate is provided
 * directly (a sample, editable in the UI) rather than pulled from a real profile.
 */

export type TailoringDebugResult = {
  ok: boolean;
  error?: string;
  model: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  content?: TailoredContent | null;
  rawJson?: string;
};

function friendlyError(err: unknown): string {
  if (err instanceof APIError) {
    if (err.code === "insufficient_quota") return "OpenAI quota exceeded — the account is out of credits.";
    if (err.status === 429) return "OpenAI is rate-limiting requests right now — try again in a moment.";
    if (err.status === 401) return "OpenAI rejected the API key — check it in this team's Settings.";
    if (err.status === 404) return `Model not found or not accessible: "${err.message}". Check the model name.`;
    return `OpenAI error (${err.status}): ${err.message}`;
  }
  return err instanceof Error ? err.message : "Tailoring request failed.";
}

export async function runTailoringDebug(opts: {
  systemPrompt: string;
  model: string;
  candidate: ResumeFields;
  jobDescription: string;
  teamId?: string | null;
}): Promise<TailoringDebugResult> {
  const start = Date.now();
  let apiKey: string;
  try {
    apiKey = await getOpenAiApiKey(opts.teamId);
  } catch (err) {
    return { ok: false, error: friendlyError(err), model: opts.model, latencyMs: 0 };
  }

  const client = new OpenAI({ apiKey, maxRetries: 1, timeout: 100_000 });
  try {
    const response = await client.responses.parse({
      model: opts.model,
      instructions: opts.systemPrompt,
      input: buildInput(opts.candidate, opts.jobDescription),
      text: { format: zodTextFormat(tailoredContentSchema, "tailored_content") },
    });
    return {
      ok: true,
      model: opts.model,
      latencyMs: Date.now() - start,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      content: response.output_parsed ?? null,
      rawJson: JSON.stringify(response.output_parsed ?? {}, null, 2),
    };
  } catch (err) {
    return { ok: false, error: friendlyError(err), model: opts.model, latencyMs: Date.now() - start };
  }
}

/** A realistic candidate used as the default input; editable in the debug UI. */
export const SAMPLE_CANDIDATE: ResumeFields = {
  fullName: "Alex Rivera",
  contactEmail: "alex.rivera@example.com",
  phone: "555-0142",
  linkedinUrl: "https://linkedin.com/in/alexrivera",
  professionalSummary: "Senior backend engineer with 9 years building scalable services.",
  city: "Austin",
  state: "TX",
  workHistory: [
    {
      id: "wh-1",
      company: "Northwind Cloud",
      jobTitle: "Senior Software Engineer",
      location: "Remote",
      workingStyle: "FULL_TIME",
      workingType: "REMOTE",
      startDate: "2021-03",
      endDate: null,
      achievements: [
        "Led migration of a monolith to microservices on Kubernetes, improving deploy frequency.",
        "Built REST and gRPC APIs in Go and Node.js serving 20M requests/day.",
        "Introduced CI/CD with GitHub Actions and reduced release time from days to hours.",
      ],
    },
    {
      id: "wh-2",
      company: "Initech",
      jobTitle: "Software Engineer",
      location: "Austin, TX",
      workingStyle: "FULL_TIME",
      workingType: "ON_SITE",
      startDate: "2017-06",
      endDate: "2021-02",
      achievements: [
        "Developed a Python/Django billing service integrating Stripe.",
        "Optimized PostgreSQL queries and added caching, cutting p95 latency.",
        "Mentored two junior engineers and ran code reviews.",
      ],
    },
  ],
  education: [
    { institution: "University of Texas", degree: "B.S.", field: "Computer Science", startDate: "2009-09", endDate: "2013-05" },
  ],
  certifications: [{ name: "AWS Certified Solutions Architect – Associate", issuer: "Amazon Web Services", issueDate: "2022-04" }],
  skills: [
    { category: "Languages", skills: ["Go", "TypeScript", "Python", "SQL"] },
    { category: "Infrastructure", skills: ["Kubernetes", "Docker", "AWS", "Terraform"] },
  ],
};
