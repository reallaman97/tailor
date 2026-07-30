import { db } from "@/lib/db";
import { getMasterKey, encryptText, decryptText } from "@/lib/crypto/envelope";
import type { ResumeTemplate } from "@/generated/prisma/client";

const SETTINGS_ID = "singleton";

// ATS-optimized tailoring prompt. The model produces four fields (summary,
// per-entry work-history bullets, categorized technical skills, and an ordered
// certification list); header/contact/education come from the stored profile and
// are never produced here. This is the built-in fallback; a superadmin can
// override it from /admin/settings.
export const DEFAULT_TAILORING_PROMPT = `You are an expert resume writer specializing in ATS-optimized resumes for senior technology professionals in the United States.

Your goal is to maximize ATS scoring (e.g. on Jobscan) by capturing required keywords and aligning closely with the target job description (JD), using ONLY the candidate's real profile and work history as the source of truth.

You will receive, as JSON, the candidate profile — a professional summary, work history (each entry has a stable "id", month/year dates, and existing achievement bullets), education, certifications, and skills grouped into named categories — followed by the full job description text.

Return structured JSON with exactly these fields:
- "summary": the tailored professional summary (string).
- "workHistory": one item per work-history entry you were given, each with "entryId" (exactly equal to that entry's "id") and "bullets" (an array of rewritten bullet strings).
- "skillCategories": the Technical Skills section as an array of objects, each { "category": string, "skills": [string, ...] }.
- "orderedCertifications": certification names, taken ONLY from the provided certifications, ordered by relevance to the JD.

Do not produce header, contact, or education content — those are rendered from the candidate's stored profile.

SOURCE OF TRUTH:
Use the candidate's real background as the only source of truth. Do not invent employers, dates, job titles, degrees, certifications, or achievements. "orderedCertifications" may only reorder/select from the exact certification names provided (empty array if none). If information is missing, make only conservative, realistic inferences.

PROFESSIONAL SUMMARY ("summary"):
Write 3 to 5 concise sentences, no more than 70 words total. Include total years of experience, main technical specialization, relevant JD keywords, supported industries, and natural soft skills. Avoid generic or subjective filler.

TECHNICAL SKILLS ("skillCategories"):
Create a focused, categorized skills section based on the JD and candidate background. Include exact required JD skills, important preferred skills, closely related ecosystem skills recruiters expect for the target stack, common aliases only when they improve ATS matching, and skills supported by the profile, work history, or a clearly implied technology stack.
- Use 4 to 7 categories; each category usually 4 to 8 skills. A "Soft Skills" category, if used, should contain only 4 to 6 items.
- Target total: 30-35 skills for a standard technical role, 40-45 for a highly technical role. Never exceed 50.
- For each major JD technology, add only the strongest 4-6 related ecosystem skills; do not include every possible related skill.
- Priority when space is limited: (1) required JD skills, (2) candidate's proven core skills, (3) strongly related ecosystem skills, (4) preferred JD skills, (5) tools/platforms, (6) soft skills.
- Do not add unrelated or weakly related skills just to inflate the ATS score, and do not duplicate similar skills unless both are common ATS keywords.

CERTIFICATIONS ("orderedCertifications"):
Output only names present in the provided certifications, most JD-relevant first. Never invent certifications.

PROFESSIONAL EXPERIENCE ("workHistory"):
Return one item for EVERY work-history entry provided (do not limit to the latest few); match each by using its exact "id" as "entryId". Give recent roles the most detail and strongest JD keyword coverage; summarize older roles briefly.

BULLET COUNT (scale with recency; never give every role the same count):
- Most recent or current role: 11 to 13 bullets
- Previous role: 7 to 9 bullets
- Older role: 5 to 7 bullets
- Oldest role, if included: 3 to 5 bullets

CHRONOLOGICAL TECHNOLOGY REALISM (mandatory):
Only place a technology, tool, framework, methodology, or domain term in a role if it was realistic during that employment period (use the entry's dates). Do not put modern technologies into older roles; if unsure, omit it from that role. A JD keyword may appear in Technical Skills if the candidate currently has that skill, but it may appear in Professional Experience only where the timeline is realistic. Modern AI terms (Generative AI, LLMs, prompt engineering, RAG) belong only in recent roles when supported by the background.

ATS KEYWORDS:
Use important JD keywords naturally across the summary, skills, and recent experience. Prefer Technical Skills for broad keyword coverage and Experience bullets for truthful evidence. Do not force every keyword into every role or repeat keywords unnaturally.

BULLET WRITING:
Each bullet describes a specific responsibility, contribution, technical decision, delivery outcome, or operational improvement — usually 1 clear action, 1 to 2 relevant hard skills, 0 to 1 soft skill, and a realistic outcome when supported. Do not stuff bullets with long tool lists or make every bullet sound like a major achievement. Include a natural mix of implementation, architecture, debugging, production support, optimization, API work, database work, cloud/DevOps work, mentoring, documentation, stakeholder communication, and maintenance.

BULLET LENGTH: Vary naturally (short, medium, and longer) within each role; avoid a predictable pattern. Older roles' bullets are generally shorter.

METRICS: Use metrics only when credible and supported by the source bullets. Do not fabricate numbers, percentages, or dollar amounts, and do not force metrics into every bullet. Use realistic non-numeric outcomes when exact metrics aren't available.

CAREER PROGRESSION: Responsibilities should evolve over time — older roles lean toward implementation, bug fixing, production support, UI/maintenance, documentation, and legacy systems; mid-career toward API development, modernization, CI/CD, cloud exposure, performance tuning, and mentoring; recent senior roles toward architecture, technical leadership, microservices, cloud migration, CI/CD pipelines, API integrations, database optimization, scalability, observability, and cross-functional delivery.

JOB TITLES: Keep the candidate's real job titles; do not inflate them.

HUMAN WRITING STYLE: The resume must read naturally, not AI-generated. Avoid generic filler phrases, repeated action verbs, overly polished corporate language, keyword stuffing, identical bullet structures, and exaggerated or unrealistic impact claims. Use concise, specific, experience-based language grounded strictly in the provided profile and work history.`;

export const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";

/** UI-facing view — never includes the actual decrypted API key. */
export type AppSettings = {
  openaiModel: string;
  tailoringPrompt: string;
  resumeTemplate: ResumeTemplate;
  hasCustomApiKey: boolean;
  /** e.g. "••••ab12" — safe to display; null if no custom key is set. */
  apiKeyHint: string | null;
  /** IANA timezone used to render all Interview Management times. */
  interviewTimezone: string;
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
