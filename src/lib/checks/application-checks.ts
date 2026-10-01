import { createHash } from "crypto";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { db } from "@/lib/db";
import { getOpenAiApiKey, getSettings } from "@/lib/settings";
import { compactJobDescription } from "@/lib/job-description";
import type { Prisma } from "@/generated/prisma/client";

const SETTINGS_ID = "singleton";

// Application Checks answer one question per application: is the posting's
// tech stack relevant to the team's target stack? Applications are batched
// into as few LLM calls as possible, verdicts are cached (ApplicationCheck)
// and only re-checked when the target stack changes, and a single run is
// capped so cost stays bounded (the UI reports how many remain).
const BATCH_SIZE = 10;
// Requirements usually sit mid-posting, so send enough of the (boilerplate-
// stripped) description to reach them — but not the whole thing.
const DESCRIPTION_CHARS = 2500;
const MAX_PER_RUN = 200;

export type CheckCriteria = {
  /** The team's target technologies, comma-separated as entered. */
  techStack: string;
};

/** The target stack as a clean, de-duplicated list (preserving the entered spelling). */
export function parseTechStack(techStack: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of techStack.split(/[,\n;]/)) {
    const tech = raw.trim();
    const key = tech.toLowerCase();
    if (tech && !seen.has(key)) {
      seen.add(key);
      out.push(tech);
    }
  }
  return out;
}

export async function getCheckCriteria(teamId?: string | null): Promise<CheckCriteria> {
  if (teamId) {
    const ts = await db.teamSettings.findUnique({ where: { teamId }, select: { checkTechStack: true } });
    if (ts) return { techStack: ts.checkTechStack };
  }
  const row = await db.appSettings.findUniqueOrThrow({ where: { id: SETTINGS_ID }, select: { checkTechStack: true } });
  return { techStack: row.checkTechStack };
}

export async function updateCheckCriteria(input: CheckCriteria, teamId?: string | null): Promise<void> {
  const data = { checkTechStack: parseTechStack(input.techStack).join(", ") };
  if (teamId) {
    await db.teamSettings.update({ where: { teamId }, data });
    return;
  }
  await db.appSettings.update({ where: { id: SETTINGS_ID }, data });
}

/** Stable fingerprint of the target stack (order/case/spacing-insensitive) — changing it marks verdicts stale. */
export function criteriaHash(c: CheckCriteria): string {
  const normalized = parseTechStack(c.techStack)
    .map((t) => t.toLowerCase())
    .sort();
  return createHash("sha1").update(JSON.stringify(["stack-v1", normalized])).digest("hex").slice(0, 16);
}

// --------------------------------------------------------------------------
// The LLM check (one call per batch)
// --------------------------------------------------------------------------

const verdictSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      relevant: z.boolean(),
      matched: z.array(z.string()),
      primaryStack: z.array(z.string()),
      reason: z.string(),
    })
  ),
});

type Verdict = z.infer<typeof verdictSchema>["results"][number];

type AppInput = { id: string; jobTitle: string; companyName: string; jobDescription: string };

function instructionsFor(stack: string[]): string {
  return [
    `You check whether each job posting's technology stack is relevant to this TARGET STACK: ${stack.join(", ")}.`,
    "Judge only the technologies the job actually works with — its required and core skills. Ignore location, work style, seniority, salary, and anything else.",
    "relevant = true when the posting's main stack substantially overlaps the target stack, or uses close equivalents in the same ecosystem (e.g. Next.js for React, PostgreSQL for MySQL, GCP for AWS). relevant = false when its main stack is different and the target technologies appear only as a passing mention or a nice-to-have.",
    "For each posting return: id (echo it exactly), relevant, matched (the target technologies the posting genuinely requires or uses, max 8), primaryStack (the posting's own main technologies, max 6), reason (at most 15 words).",
  ].join("\n");
}

async function checkBatch(
  apps: AppInput[],
  stack: string[],
  teamId?: string
): Promise<Map<string, Verdict>> {
  const [apiKey, settings] = await Promise.all([getOpenAiApiKey(teamId), getSettings(teamId)]);
  const client = new OpenAI({ apiKey, maxRetries: 1, timeout: 60_000 });

  // Short positional ids ("1", "2", …) instead of 25-char database ids — fewer
  // tokens each way, and nothing for the model to mistype.
  const input = JSON.stringify(
    apps.map((a, i) => ({
      id: String(i + 1),
      title: a.jobTitle,
      description: compactJobDescription(a.jobDescription ?? "").slice(0, DESCRIPTION_CHARS),
    }))
  );

  const response = await client.responses.parse({
    model: settings.openaiModel,
    instructions: instructionsFor(stack),
    input: `POSTINGS (JSON array):\n${input}`,
    text: { format: zodTextFormat(verdictSchema, "stack_checks") },
  });

  const map = new Map<string, Verdict>();
  for (const r of response.output_parsed?.results ?? []) {
    const app = apps[Number(r.id) - 1];
    if (app) map.set(app.id, r);
  }
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

export class NoTechStackError extends Error {
  constructor() {
    super("Set the target tech stack first.");
  }
}

export type RunChecksResult = {
  checked: number;
  passed: number;
  failed: number;
  apiCalls: number;
  remaining: number;
};

/**
 * Checks applications in scope that have no current-stack verdict yet
 * (missing or stale), batching them into as few LLM calls as possible and
 * caching each verdict. Capped at MAX_PER_RUN per run; `remaining` reports how
 * many still need checking.
 */
export async function runPendingChecks(filter: ChecksFilter): Promise<RunChecksResult> {
  const criteria = await getCheckCriteria(filter.teamId);
  const stack = parseTechStack(criteria.techStack);
  if (stack.length === 0) throw new NoTechStackError();
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
    const verdicts = await checkBatch(batch, stack, filter.teamId);
    apiCalls++;

    for (const app of batch) {
      const v = verdicts.get(app.id);
      if (!v) continue; // model skipped it — leave for the next run
      const data = {
        passed: v.relevant,
        matchedTech: v.matched.map((t) => t.slice(0, 60)).slice(0, 8),
        primaryStack: v.primaryStack.map((t) => t.slice(0, 60)).slice(0, 6),
        reason: v.reason.slice(0, 300),
        criteriaHash: hash,
      };
      await db.applicationCheck.upsert({
        where: { resumeId: app.id },
        create: { resumeId: app.id, ...data },
        update: { ...data, checkedAt: new Date() },
      });
      checked++;
      if (v.relevant) passed++;
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
  matchedTech: string[];
  primaryStack: string[];
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
      check: { select: { passed: true, matchedTech: true, primaryStack: true, reason: true, criteriaHash: true } },
    },
  });

  const applications: CheckedApplication[] = rows.map((r) => {
    let status: CheckStatus;
    if (!r.check) status = "UNCHECKED";
    else if (r.check.criteriaHash !== hash) status = "STALE";
    else status = r.check.passed ? "PASS" : "FAIL";
    const current = status === "PASS" || status === "FAIL";

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
      // A stale verdict was against a different stack — don't show its details as current.
      matchedTech: current ? (r.check?.matchedTech ?? []) : [],
      primaryStack: current ? (r.check?.primaryStack ?? []) : [],
      reason: current ? (r.check?.reason ?? null) : null,
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
