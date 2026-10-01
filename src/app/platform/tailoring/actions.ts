"use server";

import { revalidatePath } from "next/cache";
import { requireServiceAdmin } from "@/lib/auth/team-context";
import { getSettings, updateTeamSettings } from "@/lib/settings";
import { isResumeModel } from "@/lib/tailoring/models";
import { runTailoringDebug, type TailoringDebugResult } from "@/lib/tailoring/debug";
import type { ResumeFields } from "@/lib/profile/resume-fields";

export type RunDebugInput = {
  model: string;
  jobDescription: string;
  candidateJson: string;
};

/** Runs a real resume generation (secret prompt, DeepSeek) and returns the full response — never the prompt. */
export async function runTailoringDebugAction(input: RunDebugInput): Promise<TailoringDebugResult> {
  await requireServiceAdmin();

  if (!isResumeModel(input.model)) {
    return { ok: false, error: "Choose a DeepSeek model.", model: input.model, latencyMs: 0 };
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
  if (candidate.workHistory.length === 0) {
    return { ok: false, error: "Candidate needs at least one work-history entry.", model: input.model, latencyMs: 0 };
  }

  return runTailoringDebug({ model: input.model, candidate, jobDescription: input.jobDescription });
}

/** Persists the tested DeepSeek model as the active team's resume-generation model. */
export async function saveResumeModelAction(model: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireServiceAdmin();
  if (!ctx.activeTeamId) return { ok: false, error: "Select a team first (top-bar switcher)." };
  if (!isResumeModel(model)) return { ok: false, error: "Choose a DeepSeek model." };

  const current = await getSettings(ctx.activeTeamId);
  await updateTeamSettings(ctx.activeTeamId, {
    openaiModel: current.openaiModel,
    resumeModel: model,
    resumeTemplate: current.resumeTemplate,
  });
  revalidatePath("/platform/tailoring");
  revalidatePath("/admin/settings");
  return { ok: true };
}
