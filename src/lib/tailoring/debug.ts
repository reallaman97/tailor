import type { TailoredContent } from "@/lib/tailoring/schema";
import { generateTailoredContent } from "@/lib/tailoring/generate";
import { sanitizeTailoredContent } from "@/lib/tailoring/tailor-resume";
import type { ResumeFields } from "@/lib/profile/resume-fields";

/**
 * Service-admin tailoring playground. Runs the exact generation the app uses
 * (secret prompt + output contract + sanitizing) but returns the full detail —
 * parsed content, validation report, raw JSON, token usage, model, and latency.
 * The prompt itself is never returned. The candidate is provided directly (a
 * sample, editable in the UI) rather than pulled from a real profile.
 */

export type TailoringDebugResult = {
  ok: boolean;
  error?: string;
  model: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  content?: TailoredContent | null;
  rawJson?: string;
};

export async function runTailoringDebug(opts: {
  model: string;
  candidate: ResumeFields;
  jobDescription: string;
}): Promise<TailoringDebugResult> {
  const start = Date.now();
  try {
    const result = await generateTailoredContent(opts.candidate, opts.jobDescription, { model: opts.model });
    const content = sanitizeTailoredContent(
      result.output,
      new Set(opts.candidate.workHistory.map((w) => w.id)),
      (opts.candidate.certifications ?? []).map((c) => c.name)
    );
    let rawJson = result.rawJson;
    try {
      rawJson = JSON.stringify(JSON.parse(result.rawJson), null, 2);
    } catch {
      // keep the raw text as returned
    }
    return {
      ok: true,
      model: result.model,
      latencyMs: result.latencyMs,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      reasoningTokens: result.reasoningTokens,
      content,
      rawJson,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Generation request failed.",
      model: opts.model,
      latencyMs: Date.now() - start,
    };
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
