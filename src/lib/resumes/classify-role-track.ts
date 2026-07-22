import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getOpenAiApiKey } from "@/lib/settings";
import { getSettings } from "@/lib/settings";
import { ROLE_TRACK_OPTIONS } from "@/lib/resume-status";
import type { RoleTrack } from "@/generated/prisma/client";

const roleTrackValues = ROLE_TRACK_OPTIONS.map((o) => o.value) as [RoleTrack, ...RoleTrack[]];
const classificationSchema = z.object({ roleTrack: z.enum(roleTrackValues) });

const INSTRUCTIONS =
  "Classify the job posting into exactly one role track based on its title and description. " +
  "Pick the closest reasonable match; use OTHER only if none of the tracks fit at all.";

/**
 * Best-effort classification — any failure (no API key configured, network
 * error, malformed output) silently falls back to OTHER rather than blocking
 * application creation on an LLM call.
 */
export async function classifyRoleTrack(jobTitle: string, jobDescription: string): Promise<RoleTrack> {
  try {
    const [apiKey, settings] = await Promise.all([getOpenAiApiKey(), getSettings()]);
    // Best-effort classification — don't retry a failing call, just fall back to OTHER fast.
    const client = new OpenAI({ apiKey, maxRetries: 0 });

    const response = await client.responses.parse({
      model: settings.openaiModel,
      instructions: INSTRUCTIONS,
      input: `JOB TITLE: ${jobTitle}\n\nJOB DESCRIPTION:\n${jobDescription}`,
      text: { format: zodTextFormat(classificationSchema, "role_track_classification") },
    });

    return response.output_parsed?.roleTrack ?? "OTHER";
  } catch {
    return "OTHER";
  }
}
