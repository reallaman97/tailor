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
- "headline": a short professional title/tagline rendered under the candidate's name (string).
- "summary": the tailored professional summary (string).
- "workHistory": one item per work-history entry you were given, each with "entryId" (exactly equal to that entry's "id") and "bullets" (an array of rewritten bullet strings).
- "skillCategories": the Technical Skills section as an array of objects, each { "category": string, "skills": [string, ...] }.
- "orderedCertifications": certification names, taken ONLY from the provided certifications, ordered by relevance to the JD.

Do not produce the contact line or education content — the name, contact details, and education are rendered from the candidate's stored profile. (The "headline" is a tagline, NOT the contact header.)

PROFESSIONAL HEADLINE ("headline"):
A single concise line in the format "[Seniority] [Role] | [Key Skills] | [Specializations]", e.g. "Senior Full-Stack Engineer | React & Node.js | Cloud Architecture". Max 120 characters. Derive the role/seniority and specializations from the target JD and the candidate's real background — do not inflate the seniority beyond what the work history supports. Emphasize the 1-2 strongest keywords with **double asterisks**.

SOURCE OF TRUTH:
Use the candidate's real background as the only source of truth. Do not invent employers, dates, job titles, degrees, certifications, or achievements. "orderedCertifications" may only reorder/select from the exact certification names provided (empty array if none). If information is missing, make only conservative, realistic inferences.

PROFESSIONAL SUMMARY ("summary"):
Write 3 to 5 concise sentences, no more than 70 words total. Include total years of experience, main technical specialization, relevant JD keywords, supported industries, and natural soft skills. Avoid generic or subjective filler.

TECHNICAL SKILLS ("skillCategories"):
This is the PRIMARY place for ATS keyword coverage — capture the job description's keywords comprehensively. First extract EVERY skill, technology, framework, library, tool, platform, database, cloud service, methodology, protocol, standard, and technical domain term explicitly named in the JD — required AND preferred / "nice to have" — and include all of them. Then add the strongest ecosystem skills a recruiter expects for that stack, common aliases that improve ATS matching (e.g. "CI/CD" and "Continuous Integration"; "K8s" and "Kubernetes"), and skills evidenced by the candidate's profile or work history. NEVER drop a keyword the JD explicitly mentions.
- Group into 5 to 9 clear categories (e.g. Languages, Frameworks & Libraries, Cloud & Infrastructure, Databases, DevOps & CI/CD, Testing, Security, Tools & Platforms, Methodologies, Soft Skills); each category holds as many relevant skills as apply. A "Soft Skills" category stays to 4-6 items.
- Aim for COMPREHENSIVE coverage: typically 45-65 skills, and up to ~75 for a very keyword-dense JD. Favour completeness of JD keyword coverage over brevity.
- Priority when trimming: (1) every keyword explicitly in the JD, (2) the candidate's proven core skills, (3) strong ecosystem skills for the JD's stack, (4) tools/platforms, (5) soft skills.
- Use proper title case, deduplicate near-identical variants (keep the JD's exact spelling), and don't invent skills unrelated to both the JD and the candidate.

CERTIFICATIONS ("orderedCertifications"):
Output only names present in the provided certifications, most JD-relevant first. Never invent certifications.

PROFESSIONAL EXPERIENCE ("workHistory"):
Return one item for EVERY work-history entry provided (do not limit to the latest few); match each by using its exact "id" as "entryId". Give recent roles the most detail and strongest JD keyword coverage; summarize older roles briefly.

SENIORITY ALIGNMENT (match each role's bullets to the seniority its job title implies):
- Lead/Principal/Staff: senior-level scope, very high complexity, technical leadership, architecture ownership, and strategic impact.
- Senior: senior-level scope, high complexity, and mentorship — but not org/people leadership.
- Mid / Software Engineer: moderate complexity, independent implementation. No people leadership, no mentorship, no architecture ownership.
- Junior/Associate: lower complexity, assisting and learning under supervision. No leadership, mentorship, or architecture.
Never attribute leadership or architecture ownership to a mid or junior role.

BULLET COUNT (scale with recency; never give every role the same count):
- Most recent or current role: 11 to 13 bullets
- Previous role: 7 to 9 bullets
- Older role: 5 to 7 bullets
- Oldest role, if included: 3 to 5 bullets

CHRONOLOGICAL TECHNOLOGY REALISM (mandatory):
Only place a technology, tool, framework, methodology, or domain term in a role if it was realistic during that employment period (use the entry's dates). Do not put modern technologies into older roles; if unsure, omit it from that role. A JD keyword may appear in Technical Skills if the candidate currently has that skill, but it may appear in Professional Experience only where the timeline is realistic. Modern AI terms (Generative AI, LLMs, prompt engineering, RAG) belong only in recent roles when supported by the background.

ATS KEYWORDS:
Weave the JOB DESCRIPTION's exact keywords and multi-word phrases — technologies, frameworks, tools, methodologies, and domain terms — directly INTO the experience bullets wherever the candidate's real background supports them; this is where an ATS credits evidence, so keyword coverage in Experience matters as much as in Technical Skills. Use the JD's exact phrasing (e.g. "CI/CD pipelines", "event-driven microservices", "infrastructure as code", "RESTful APIs", "distributed systems") rather than only single-word skills. Each recent-role bullet should carry 2-4 relevant JD keywords/phrases used naturally in context. Do not repeat the same keyword unnaturally or force a keyword into a role where it doesn't fit the timeline.

BULLET WRITING:
Open every bullet with a strong past-tense action/power verb (e.g. Led, Built, Designed, Architected, Optimized, Automated, Delivered, Migrated) — never with "Responsible for" or a noun. Write FULL, substantive bullets: each is a complete sentence that states WHAT the candidate did, the SPECIFIC technologies/tools (using the JD's exact terms), HOW or in what context, and a realistic OUTCOME or impact. Include a natural mix of implementation, architecture, debugging, production support, optimization, API work, database work, cloud/DevOps work, mentoring, documentation, stakeholder communication, and maintenance. Integrate the technologies into the sentence naturally — do NOT tack on a bare comma-separated tool dump — and don't make every bullet a headline achievement.

BULLET LENGTH: Bullets must be complete, detailed sentences — target roughly 20-32 words each (about 1.5-2 lines), never terse one-liners or fragments. Vary length naturally so they don't read mechanically; older roles may run slightly shorter but must still be full sentences with context, technologies, and an outcome.

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

/**
 * Effective settings. With a `teamId`, reads that team's TeamSettings row
 * (multi-tenancy — each team brings its own OpenAI key/model/prompt); falls
 * back to the platform singleton when no team is given or its row is missing,
 * so callers without team context behave exactly as before.
 */
export async function getSettings(teamId?: string | null): Promise<AppSettings> {
  if (teamId) {
    const ts = await db.teamSettings.findUnique({ where: { teamId } });
    if (ts) {
      return {
        openaiModel: ts.openaiModel,
        tailoringPrompt: ts.tailoringPrompt ?? DEFAULT_TAILORING_PROMPT,
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

/** Persists a team's OpenAI/resume settings. `openaiApiKey`: undefined = leave, null = clear, string = set. */
export async function updateTeamSettings(
  teamId: string,
  input: { openaiModel: string; tailoringPrompt: string; resumeTemplate: ResumeTemplate; openaiApiKey?: string | null }
): Promise<void> {
  await db.teamSettings.upsert({
    where: { teamId },
    create: {
      teamId,
      openaiModel: input.openaiModel,
      tailoringPrompt: input.tailoringPrompt,
      resumeTemplate: input.resumeTemplate,
      ...(input.openaiApiKey ? { openaiApiKeyEnc: encryptText(getMasterKey(), input.openaiApiKey) } : {}),
    },
    update: {
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
