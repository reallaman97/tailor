import { db } from "@/lib/db";
import { getMasterKey, encryptText, decryptText } from "@/lib/crypto/envelope";
import type { ResumeTemplate } from "@/generated/prisma/client";

const SETTINGS_ID = "singleton";

// Reviewed prompt — grounded rewriting, not generation. The model may only
// rephrase/reorder/select from what's already in the candidate's real
// profile; it must never invent experience, skills, or metrics. This is the
// built-in fallback; a superadmin can override it from /admin/settings.
export const DEFAULT_TAILORING_PROMPT = `You are a resume-tailoring assistant. You rewrite a candidate's existing resume content to better match a specific job description. You do not invent new experience.

You will be given, as JSON, the candidate's real profile — contact info, a professional summary, work history (each entry has a stable "id"), education, and skills grouped into named categories (the category names vary per candidate, e.g. "Languages", "Certifications") — followed by the full text of a job posting.

Your task:
- Write a new 2-4 sentence professional summary tailored to this job, grounded strictly in the candidate's real background. Do not claim skills, experience, or years of experience that aren't evidenced in the provided profile.
- For each work history entry, rewrite its achievement bullets to emphasize what's most relevant to the job description, using terminology and phrasing that aligns with the posting where it's honestly applicable. You may rephrase, reorder, tighten, and better quantify claims that are already present. You may NOT invent new metrics, responsibilities, tools, or outcomes that are not supported by the original bullets. Return one entry per work history item you were given, and every entry's "entryId" must exactly match the "id" given in the input.
- From the candidate's skill list, select and reorder the skills most relevant to this job. Do not add any skill that is not already present in the provided list.
- If the profile doesn't support a strong tailored angle for something, keep it modest and accurate rather than embellishing.`;

export const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";

/** UI-facing view — never includes the actual decrypted API key. */
export type AppSettings = {
  openaiModel: string;
  tailoringPrompt: string;
  resumeTemplate: ResumeTemplate;
  hasCustomApiKey: boolean;
  /** e.g. "••••ab12" — safe to display; null if no custom key is set. */
  apiKeyHint: string | null;
};

export type UpdateSettingsInput = {
  openaiModel: string;
  tailoringPrompt: string;
  resumeTemplate: ResumeTemplate;
  /** undefined = leave the stored key untouched, null = clear it, string = set/replace it. */
  openaiApiKey?: string | null;
};

function maskKey(key: string): string {
  return key.length <= 4 ? "••••" : `••••${key.slice(-4)}`;
}

export async function getSettings(): Promise<AppSettings> {
  const row = await db.appSettings.findUniqueOrThrow({ where: { id: SETTINGS_ID } });
  const apiKeyHint = row.openaiApiKeyEnc
    ? maskKey(decryptText(getMasterKey(), row.openaiApiKeyEnc))
    : null;

  return {
    openaiModel: row.openaiModel,
    tailoringPrompt: row.tailoringPrompt ?? DEFAULT_TAILORING_PROMPT,
    resumeTemplate: row.resumeTemplate,
    hasCustomApiKey: row.openaiApiKeyEnc !== null,
    apiKeyHint,
  };
}

export async function updateSettings(input: UpdateSettingsInput): Promise<void> {
  await db.appSettings.update({
    where: { id: SETTINGS_ID },
    data: {
      openaiModel: input.openaiModel,
      tailoringPrompt: input.tailoringPrompt,
      resumeTemplate: input.resumeTemplate,
      ...(input.openaiApiKey === null
        ? { openaiApiKeyEnc: null }
        : input.openaiApiKey
          ? { openaiApiKeyEnc: encryptText(getMasterKey(), input.openaiApiKey) }
          : {}),
    },
  });
}

export class NoOpenAiApiKeyError extends Error {
  constructor() {
    super("No OpenAI API key configured — set one in Settings or the OPENAI_API_KEY environment variable.");
  }
}

/** The actual usable key for calling OpenAI — a custom Settings key takes precedence over the env var. */
export async function getOpenAiApiKey(): Promise<string> {
  const row = await db.appSettings.findUniqueOrThrow({ where: { id: SETTINGS_ID } });
  if (row.openaiApiKeyEnc) return decryptText(getMasterKey(), row.openaiApiKeyEnc);

  const envKey = process.env.OPENAI_API_KEY;
  if (!envKey) throw new NoOpenAiApiKeyError();
  return envKey;
}
