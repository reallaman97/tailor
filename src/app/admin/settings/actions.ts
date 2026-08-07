"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import OpenAI, { AuthenticationError, APIError } from "openai";
import { requireTeamAdmin } from "@/lib/auth/team-context";
import { updateTeamSettings, getOpenAiApiKey, NoOpenAiApiKeyError } from "@/lib/settings";

const settingsSchema = z.object({
  openaiModel: z.string().trim().min(1, "Model is required"),
  tailoringPrompt: z.string().trim().min(1, "Prompt is required"),
  resumeTemplate: z.enum(["MODERN", "CLASSIC"]),
  openaiApiKey: z.string().optional(),
  clearOpenaiApiKey: z.string().optional(),
});

export type SettingsActionState = { error?: string; success?: boolean } | undefined;

export async function updateSettingsAction(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const ctx = await requireTeamAdmin();
  if (!ctx.activeTeamId) return { error: "Select a team first." };

  const parsed = settingsSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { openaiModel, tailoringPrompt, resumeTemplate, openaiApiKey, clearOpenaiApiKey } = parsed.data;

  await updateTeamSettings(ctx.activeTeamId, {
    openaiModel,
    tailoringPrompt,
    resumeTemplate,
    openaiApiKey:
      clearOpenaiApiKey === "true" ? null : openaiApiKey && openaiApiKey.trim() !== "" ? openaiApiKey.trim() : undefined,
  });

  revalidatePath("/admin/settings");
  return { success: true };
}

export type TestKeyResult = { success: boolean; error?: string };

/**
 * Verifies an OpenAI API key with a cheap, no-cost call (models.list) —
 * never persists anything. If candidateKey is blank, tests whichever key is
 * currently active (custom Settings key or the OPENAI_API_KEY env var).
 */
export async function testOpenAiKeyAction(candidateKey: string): Promise<TestKeyResult> {
  const ctx = await requireTeamAdmin();

  let key: string;
  if (candidateKey.trim() !== "") {
    key = candidateKey.trim();
  } else {
    try {
      key = await getOpenAiApiKey(ctx.activeTeamId);
    } catch (err) {
      if (err instanceof NoOpenAiApiKeyError) return { success: false, error: err.message };
      throw err;
    }
  }

  try {
    const client = new OpenAI({ apiKey: key });
    await client.models.list();
    return { success: true };
  } catch (err) {
    if (err instanceof AuthenticationError) {
      return { success: false, error: "That key was rejected by OpenAI — check it's correct and active." };
    }
    if (err instanceof APIError) {
      return { success: false, error: `OpenAI returned an error: ${err.message}` };
    }
    return { success: false, error: "Couldn't reach OpenAI — check your network connection and try again." };
  }
}
