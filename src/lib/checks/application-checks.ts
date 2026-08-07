import { createHash } from "crypto";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { db } from "@/lib/db";
import { getOpenAiApiKey, getSettings } from "@/lib/settings";
import type { Prisma } from "@/generated/prisma/client";

const SETTINGS_ID = "singleton";

// Batch many applications into one LLM call — the whole point of "smallest API
// calls". Cached verdicts (ApplicationCheck) are never re-sent; only pending or
// criteria-stale applications are checked, and a single run is capped so cost
// stays bounded (the UI reports how many remain).
const BATCH_SIZE = 15;
const DESCRIPTION_CHARS = 1200;
const MAX_PER_RUN = 200;

export type WorkStyle = "REMOTE" | "HYBRID" | "ONSITE" | "ANY";

export const WORK_STYLE_OPTIONS: { value: WorkStyle; label: string }[] = [
  { value: "REMOTE", label: "Fully Remote" },
  { value: "HYBRID", label: "Hybrid" },
  { value: "ONSITE", label: "On-site" },
  { value: "ANY", label: "Any" },
];

export type CheckCriteria = {
  country: string; // e.g. "US", or "ANY"
  workStyle: WorkStyle;
  jobCategory: string;
};

function normalizeWorkStyle(value: string): WorkStyle {
  return value === "HYBRID" || value === "ONSITE" || value === "ANY" ? value : "REMOTE";
}

export async function getCheckCriteria(teamId?: string | null): Promise<CheckCriteria> {
  if (teamId) {
    const ts = await db.teamSettings.findUnique({
      where: { teamId },
      select: { checkCountry: true, checkWorkStyle: true, checkJobCategory: true },
    });
    if (ts) {
      return { country: ts.checkCountry, workStyle: normalizeWorkStyle(ts.checkWorkStyle), jobCategory: ts.checkJobCategory };
    }
  }
  const row = await db.appSettings.findUniqueOrThrow({
    where: { id: SETTINGS_ID },
    select: { checkCountry: true, checkWorkStyle: true, checkJobCategory: true },
  });
  return {
    country: row.checkCountry,
    workStyle: normalizeWorkStyle(row.checkWorkStyle),
    jobCategory: row.checkJobCategory,
  };
}

export async function updateCheckCriteria(input: CheckCriteria, teamId?: string | null): Promise<void> {
  const data = {
    checkCountry: input.country.trim() || "ANY",
    checkWorkStyle: input.workStyle,
    checkJobCategory: input.jobCategory.trim(),
  };
  if (teamId) {
    await db.teamSettings.update({ where: { teamId }, data });
    return;
  }
  await db.appSettings.update({ where: { id: SETTINGS_ID }, data });
}

/** Short stable fingerprint of the criteria — changing any criterion marks existing verdicts stale. */
export function criteriaHash(c: CheckCriteria): string {
  return createHash("sha1")
    .update(JSON.stringify([c.country.trim().toLowerCase(), c.workStyle, c.jobCategory.trim().toLowerCase()]))
    .digest("hex")
    .slice(0, 16);
}

// --------------------------------------------------------------------------
// The LLM check (one call per batch)
// --------------------------------------------------------------------------

const verdictSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      countryOk: z.boolean(),
      remoteOk: z.boolean(),
      categoryOk: z.boolean(),
      detectedCountry: z.string(),
      detectedWorkStyle: z.string(),
      detectedCategory: z.string(),
      reason: z.string(),
    })
  ),
});

type Verdict = z.infer<typeof verdictSchema>["results"][number];

type AppInput = { id: string; jobTitle: string; companyName: string; jobDescription: string };

function instructionsFor(criteria: CheckCriteria): string {
  const workStyleLabel = WORK_STYLE_OPTIONS.find((o) => o.value === criteria.workStyle)?.label ?? "Fully Remote";
  return [
    "You review job applications and decide whether each one matches the hiring criteria. Judge only from the job posting text.",
    "For EACH application, evaluate three criteria independently:",
    `1) COUNTRY — the job must be based in / hiring from: ${criteria.country === "ANY" ? "any country (countryOk is always true)." : criteria.country + ". countryOk=true only if the posting is for that country (US-based, remote-US, etc.)."}`,
    `2) WORK STYLE — the job must be: ${workStyleLabel}. ${criteria.workStyle === "ANY" ? "remoteOk is always true." : "remoteOk=true only if the posting clearly matches that work style."}`,
    `3) JOB CATEGORY — the role must fall under: ${criteria.jobCategory} categoryOk=true only if the job title/description is such a role.`,
    "Also report what you detected: detectedCountry (e.g. \"US\", \"UK\", \"Unknown\"), detectedWorkStyle (\"Remote\"/\"Hybrid\"/\"On-site\"/\"Unknown\"), detectedCategory (a short label like \"Software Engineering\", \"Sales\"), and a one-sentence reason.",
    "When a criterion is genuinely indeterminable from the text, set that ok to false and say so in the reason. Return one result object per application, echoing its exact id.",
  ].join("\n");
}

async function checkBatch(apps: AppInput[], criteria: CheckCriteria, teamId?: string): Promise<Map<string, Verdict>> {
  const [apiKey, settings] = await Promise.all([getOpenAiApiKey(teamId), getSettings(teamId)]);
  const client = new OpenAI({ apiKey, maxRetries: 1, timeout: 60_000 });

  const input = JSON.stringify(
    apps.map((a) => ({
      id: a.id,
      jobTitle: a.jobTitle,
      company: a.companyName,
      description: (a.jobDescription ?? "").slice(0, DESCRIPTION_CHARS),
    }))
  );

  const response = await client.responses.parse({
    model: settings.openaiModel,
    instructions: instructionsFor(criteria),
    input: `APPLICATIONS (JSON array):\n${input}`,
    text: { format: zodTextFormat(verdictSchema, "application_checks") },
  });

  const map = new Map<string, Verdict>();
  for (const r of response.output_parsed?.results ?? []) map.set(r.id, r);
  return map;
}

// --------------------------------------------------------------------------
// Scope + run
// --------------------------------------------------------------------------

export type ChecksFilter = {
  from?: Date;
  to?: Date; // exclusive upper bound
  profileId?: string;
  bidderId?: string;
  /** Scope to one team (multi-tenancy). Omitted = all teams. */
  teamId?: string;
};

function scopeWhere(filter: ChecksFilter): Prisma.ResumeWhereInput {
  const where: Prisma.ResumeWhereInput = {};
  if (filter.teamId) where.teamId = filter.teamId;
  if (filter.profileId) where.profileId = filter.profileId;
  if (filter.bidderId) where.userId = filter.bidderId;
  if (filter.from || filter.to) {
    where.createdAt = { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lt: filter.to } : {}) };
  }
  return where;
}

export type RunChecksResult = {
  checked: number;
  passed: number;
  failed: number;
  apiCalls: number;
  remaining: number;
};

/**
 * Checks applications in scope that have no current-criteria verdict yet
 * (missing or stale), batching them into as few LLM calls as possible and
 * caching each verdict. Capped at MAX_PER_RUN per run; `remaining` reports how
 * many still need checking.
 */
export async function runPendingChecks(filter: ChecksFilter): Promise<RunChecksResult> {
  const criteria = await getCheckCriteria(filter.teamId);
  const hash = criteriaHash(criteria);

  const pendingWhere: Prisma.ResumeWhereInput = {
    ...scopeWhere(filter),
    OR: [{ check: { is: null } }, { check: { criteriaHash: { not: hash } } }],
  };

  const remainingBefore = await db.resume.count({ where: pendingWhere });
  const pending = await db.resume.findMany({
    where: pendingWhere,
    orderBy: { createdAt: "desc" },
    take: MAX_PER_RUN,
    select: { id: true, jobTitle: true, companyName: true, jobDescription: true },
  });

  let checked = 0;
  let passed = 0;
  let failed = 0;
  let apiCalls = 0;

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const verdicts = await checkBatch(batch, criteria, filter.teamId);
    apiCalls++;

    for (const app of batch) {
      const v = verdicts.get(app.id);
      if (!v) continue; // model skipped it — leave for the next run
      const passedNow = v.countryOk && v.remoteOk && v.categoryOk;
      const data = {
        passed: passedNow,
        countryOk: v.countryOk,
        remoteOk: v.remoteOk,
        categoryOk: v.categoryOk,
        detectedCountry: v.detectedCountry.slice(0, 120),
        detectedWorkStyle: v.detectedWorkStyle.slice(0, 60),
        detectedCategory: v.detectedCategory.slice(0, 120),
        reason: v.reason.slice(0, 500),
        criteriaHash: hash,
      };
      await db.applicationCheck.upsert({
        where: { resumeId: app.id },
        create: { resumeId: app.id, ...data },
        update: { ...data, checkedAt: new Date() },
      });
      checked++;
      if (passedNow) passed++;
      else failed++;
    }
  }

  return { checked, passed, failed, apiCalls, remaining: Math.max(0, remainingBefore - checked) };
}

// --------------------------------------------------------------------------
// Listing for the UI
// --------------------------------------------------------------------------

export type CheckStatus = "PASS" | "FAIL" | "UNCHECKED" | "STALE";

export type CheckedApplication = {
  id: string;
  day: string; // YYYY-MM-DD (UTC of createdAt)
  createdAt: Date;
  bidderId: string;
  bidderName: string;
  companyName: string;
  jobTitle: string;
  jobLink: string | null;
  status: CheckStatus;
  countryOk: boolean | null;
  remoteOk: boolean | null;
  categoryOk: boolean | null;
  detectedCountry: string | null;
  detectedWorkStyle: string | null;
  detectedCategory: string | null;
  reason: string | null;
};

export type ChecksSummary = {
  total: number;
  passed: number;
  failed: number;
  unchecked: number;
  stale: number;
};

export type ChecksResult = {
  criteria: CheckCriteria;
  applications: CheckedApplication[];
  summary: ChecksSummary;
};

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function listApplicationChecks(filter: ChecksFilter): Promise<ChecksResult> {
  const criteria = await getCheckCriteria(filter.teamId);
  const hash = criteriaHash(criteria);

  const rows = await db.resume.findMany({
    where: scopeWhere(filter),
    orderBy: { createdAt: "desc" },
    take: 1000,
    select: {
      id: true,
      createdAt: true,
      companyName: true,
      jobTitle: true,
      jobLink: true,
      userId: true,
      user: { select: { username: true, email: true } },
      check: {
        select: {
          passed: true,
          countryOk: true,
          remoteOk: true,
          categoryOk: true,
          detectedCountry: true,
          detectedWorkStyle: true,
          detectedCategory: true,
          reason: true,
          criteriaHash: true,
        },
      },
    },
  });

  const applications: CheckedApplication[] = rows.map((r) => {
    let status: CheckStatus;
    if (!r.check) status = "UNCHECKED";
    else if (r.check.criteriaHash !== hash) status = "STALE";
    else status = r.check.passed ? "PASS" : "FAIL";

    return {
      id: r.id,
      day: dayKey(r.createdAt),
      createdAt: r.createdAt,
      bidderId: r.userId,
      bidderName: r.user?.username ?? r.user?.email ?? "Unknown",
      companyName: r.companyName,
      jobTitle: r.jobTitle,
      jobLink: r.jobLink,
      status,
      countryOk: r.check?.countryOk ?? null,
      remoteOk: r.check?.remoteOk ?? null,
      categoryOk: r.check?.categoryOk ?? null,
      detectedCountry: r.check?.detectedCountry ?? null,
      detectedWorkStyle: r.check?.detectedWorkStyle ?? null,
      detectedCategory: r.check?.detectedCategory ?? null,
      reason: r.check?.reason ?? null,
    };
  });

  const summary: ChecksSummary = {
    total: applications.length,
    passed: applications.filter((a) => a.status === "PASS").length,
    failed: applications.filter((a) => a.status === "FAIL").length,
    unchecked: applications.filter((a) => a.status === "UNCHECKED").length,
    stale: applications.filter((a) => a.status === "STALE").length,
  };

  return { criteria, applications, summary };
}
