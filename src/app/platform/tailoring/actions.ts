"use server";

import { revalidatePath } from "next/cache";
import { requireServiceAdmin } from "@/lib/auth/team-context";
import { getSettings, updateTeamSettings } from "@/lib/settings";
import { runTailoringDebug, type TailoringDebugResult } from "@/lib/tailoring/debug";
import type { ResumeFields } from "@/lib/profile/resume-fields";

export type RunDebugInput = {
  systemPrompt: string;
  model: string;
  jobDescription: string;
  candidateJson: string;
};

/** Runs a tailoring request against OpenAI with the active team's key and returns the full response. */
export async function runTailoringDebugAction(input: RunDebugInput): Promise<TailoringDebugResult> {
  const ctx = await requireServiceAdmin();

  if (!input.model.trim()) {
    return { ok: false, error: "Enter a model name.", model: input.model, latencyMs: 0 };
  }
  if (!input.jobDescription.trim()) {
    return { ok: false, error: "Paste a job description to tailor against.", model: input.model, latencyMs: 0 };
  }

  let candidate: ResumeFields;
  try {
    candidate = JSON.parse(input.candidateJson) as ResumeFields;
  } catch {
    return { ok: false, error: "Candidate profile isn't valid JSON.", model: input.model, latencyMs: 0 };
  }
  if (!candidate || typeof candidate !== "object" || !Array.isArray(candidate.workHistory)) {
    return { ok: false, error: "Candidate JSON must be a profile object with a workHistory array.", model: input.model, latencyMs: 0 };
  }

  return runTailoringDebug({
    systemPrompt: input.systemPrompt,
    model: input.model.trim(),
    candidate,
    jobDescription: input.jobDescription,
    teamId: ctx.activeTeamId,
  });
}

/** Persists the tested model + prompt as the active team's tailoring defaults. */
export async function saveTailoringDefaultsAction(
  model: string,
  prompt: string
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireServiceAdmin();
  if (!ctx.activeTeamId) return { ok: false, error: "Select a team first (top-bar switcher)." };
  if (!model.trim()) return { ok: false, error: "Model is required." };
  if (!prompt.trim()) return { ok: false, error: "Prompt can't be empty." };

  const current = await getSettings(ctx.activeTeamId);
  await updateTeamSettings(ctx.activeTeamId, {
    openaiModel: model.trim(),
    tailoringPrompt: prompt,
    resumeTemplate: current.resumeTemplate,
  });
  revalidatePath("/platform/tailoring");
  revalidatePath("/admin/settings");
  return { ok: true };
}
