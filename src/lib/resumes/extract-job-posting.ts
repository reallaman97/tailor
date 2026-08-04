import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getOpenAiApiKey, getSettings } from "@/lib/settings";
import { ROLE_TRACK_OPTIONS } from "@/lib/resume-status";
import type { RoleTrack } from "@/generated/prisma/client";

const roleTrackValues = ROLE_TRACK_OPTIONS.map((o) => o.value) as [RoleTrack, ...RoleTrack[]];

const schema = z.object({
  companyName: z.string(),
  jobTitle: z.string(),
  roleTrack: z.enum(roleTrackValues),
});

export type ExtractedPosting = { companyName: string; jobTitle: string; roleTrack: RoleTrack };

function fallbackCompany(pageUrl?: string): string {
  try {
    if (pageUrl) return new URL(pageUrl).hostname.replace(/^www\./, "");
  } catch {
    // ignore malformed URL
  }
  return "Unknown Company";
}

/**
 * Derives the hiring company, job title, and role track from a job description
 * (plus optional page hints) in a single LLM call — used by the browser
 * extension's one-click flow, where only the selected description is available.
 * Best-effort: any failure falls back to the page domain / generic values so a
 * build is never blocked.
 */
export async function extractJobPosting(
  jobDescription: string,
  hints?: { pageTitle?: string; pageUrl?: string }
): Promise<ExtractedPosting> {
  try {
    const [apiKey, settings] = await Promise.all([getOpenAiApiKey(), getSettings()]);
    const client = new OpenAI({ apiKey, maxRetries: 0, timeout: 30_000 });

    const response = await client.responses.parse({
      model: settings.openaiModel,
      instructions:
        "From a job posting, extract the hiring company name and the job title, and classify the posting into exactly one role track. " +
        "Prefer the description; use the page title/URL hints when the description doesn't name the company. If the company truly can't be determined, use the site's domain. Keep the job title concise (no seniority padding beyond what's stated).",
      input: `PAGE TITLE: ${hints?.pageTitle ?? ""}\nPAGE URL: ${hints?.pageUrl ?? ""}\n\nJOB DESCRIPTION:\n${jobDescription}`,
      text: { format: zodTextFormat(schema, "job_posting") },
    });

    const out = response.output_parsed;
    return {
      companyName: (out?.companyName?.trim() || fallbackCompany(hints?.pageUrl)).slice(0, 200),
      jobTitle: (out?.jobTitle?.trim() || "Role").slice(0, 200),
      roleTrack: out?.roleTrack ?? "OTHER",
    };
  } catch {
    return { companyName: fallbackCompany(hints?.pageUrl), jobTitle: "Role", roleTrack: "OTHER" };
  }
}
