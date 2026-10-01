import { db } from "@/lib/db";
import { getMasterKey, encryptText, decryptText } from "@/lib/crypto/envelope";
import { normalizeResumeModel, type ResumeModelId } from "@/lib/tailoring/models";
import type { ResumeTemplate } from "@/generated/prisma/client";

const SETTINGS_ID = "singleton";

// Resume generation runs on DeepSeek with a secret prompt that lives only in
// the RESUME_PROMPT_B64 env var (src/lib/tailoring/resume-prompt.ts) — it is
// deliberately NOT part of these settings, so no page can read or edit it.
// The OpenAI model/key here drive the smaller features: role-track
// classification, job-posting extraction, and Application Checks.

export const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";

/** UI-facing view — never includes the actual decrypted API key. */
export type AppSettings = {
  openaiModel: string;
  /** DeepSeek model used for resume generation. */
  resumeModel: ResumeModelId;
  resumeTemplate: ResumeTemplate;
  hasCustomApiKey: boolean;
  /** e.g. "••••ab12" — safe to display; null if no custom key is set. */
  apiKeyHint: string | null;
  /** IANA timezone used to render all Interview Management times. */
  interviewTimezone: string;
};

export type UpdateSettingsInput = {
  openaiModel: string;
  resumeModel: ResumeModelId;
  resumeTemplate: ResumeTemplate;
  /** undefined = leave the stored key untouched, null = clear it, string = set/replace it. */
  openaiApiKey?: string | null;
};

function maskKey(key: string): string {
  return key.length <= 4 ? "••••" : `••••${key.slice(-4)}`;
}

/**
 * Effective settings. With a `teamId`, reads that team's TeamSettings row
 * (multi-tenancy — each team brings its own OpenAI key/model); falls back to
 * the platform singleton when no team is given or its row is missing, so
 * callers without team context behave exactly as before.
 */
export async function getSettings(teamId?: string | null): Promise<AppSettings> {
  if (teamId) {
    const ts = await db.teamSettings.findUnique({ where: { teamId } });
    if (ts) {
      return {
        openaiModel: ts.openaiModel,
        resumeModel: normalizeResumeModel(ts.resumeModel),
        resumeTemplate: ts.resumeTemplate,
        hasCustomApiKey: ts.openaiApiKeyEnc !== null,
        apiKeyHint: ts.openaiApiKeyEnc ? maskKey(decryptText(getMasterKey(), ts.openaiApiKeyEnc)) : null,
        interviewTimezone: ts.interviewTimezone,
      };
    }
  }

  const row = await db.appSettings.findUniqueOrThrow({ where: { id: SETTINGS_ID } });
  const apiKeyHint = row.openaiApiKeyEnc
    ? maskKey(decryptText(getMasterKey(), row.openaiApiKeyEnc))
    : null;

  return {
    openaiModel: row.openaiModel,
    resumeModel: normalizeResumeModel(row.resumeModel),
    resumeTemplate: row.resumeTemplate,
    hasCustomApiKey: row.openaiApiKeyEnc !== null,
    apiKeyHint,
    interviewTimezone: row.interviewTimezone,
  };
}

/** The interview-display timezone alone — cheaper than getSettings() when that's all you need. */
export async function getInterviewTimezone(): Promise<string> {
  const row = await db.appSettings.findUniqueOrThrow({
    where: { id: SETTINGS_ID },
    select: { interviewTimezone: true },
  });
  return row.interviewTimezone;
}

/** Updates only the interview timezone, leaving the OpenAI/resume settings untouched. */
export async function updateInterviewTimezone(timezone: string): Promise<void> {
  await db.appSettings.update({ where: { id: SETTINGS_ID }, data: { interviewTimezone: timezone } });
}

export async function updateSettings(input: UpdateSettingsInput): Promise<void> {
  await db.appSettings.update({
    where: { id: SETTINGS_ID },
    data: {
      openaiModel: input.openaiModel,
      resumeModel: input.resumeModel,
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

/**
 * The usable OpenAI key. Precedence: the team's own key (each team brings its
 * own) → the platform singleton key → the OPENAI_API_KEY env var. Throws if
 * none is configured.
 */
export async function getOpenAiApiKey(teamId?: string | null): Promise<string> {
  if (teamId) {
    const ts = await db.teamSettings.findUnique({ where: { teamId }, select: { openaiApiKeyEnc: true } });
    if (ts?.openaiApiKeyEnc) return decryptText(getMasterKey(), ts.openaiApiKeyEnc);
  }

  const row = await db.appSettings.findUniqueOrThrow({ where: { id: SETTINGS_ID } });
  if (row.openaiApiKeyEnc) return decryptText(getMasterKey(), row.openaiApiKeyEnc);

  const envKey = process.env.OPENAI_API_KEY;
  if (!envKey) throw new NoOpenAiApiKeyError();
  return envKey;
}

export class NoDeepSeekApiKeyError extends Error {
  constructor() {
    super("Resume generation isn't configured — the DEEPSEEK_API_KEY environment variable is missing.");
  }
}

/** The platform's DeepSeek key (env only — it powers the secret resume prompt, so it isn't team-configurable). */
export function getDeepSeekApiKey(): string {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  if (!key) throw new NoDeepSeekApiKeyError();
  return key;
}

/** Persists a team's AI/resume settings. `openaiApiKey`: undefined = leave, null = clear, string = set. */
export async function updateTeamSettings(
  teamId: string,
  input: {
    openaiModel: string;
    resumeModel: ResumeModelId;
    resumeTemplate: ResumeTemplate;
    openaiApiKey?: string | null;
  }
): Promise<void> {
  await db.teamSettings.upsert({
    where: { teamId },
    create: {
      teamId,
      openaiModel: input.openaiModel,
      resumeModel: input.resumeModel,
      resumeTemplate: input.resumeTemplate,
      ...(input.openaiApiKey ? { openaiApiKeyEnc: encryptText(getMasterKey(), input.openaiApiKey) } : {}),
    },
    update: {
      openaiModel: input.openaiModel,
      resumeModel: input.resumeModel,
      resumeTemplate: input.resumeTemplate,
      ...(input.openaiApiKey === null
        ? { openaiApiKeyEnc: null }
        : input.openaiApiKey
          ? { openaiApiKeyEnc: encryptText(getMasterKey(), input.openaiApiKey) }
          : {}),
    },
  });
}
