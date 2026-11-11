import { db } from "@/lib/db";
import { companyKey } from "@/lib/resumes/duplicates";
import { getPrimaryStatus } from "@/lib/resume-status";
import { isAtsSender, companyFromSenderName } from "@/lib/inbox/classify-rules";
import type { ResumeStatus } from "@/generated/prisma/client";

// Which of the profile's applications an email is about, and how a confident
// rejection / next step moves it in the Interview tracker.

const GENERIC_DOMAINS = /^(gmail|googlemail|yahoo|outlook|hotmail|live|icloud|me|aol|proton|protonmail|mail|email|linkedin|indeed)$/i;

/** Possible company names for an email, best first. */
export function companyCandidates(input: { companyName: string | null; fromName: string | null; fromAddress: string }): string[] {
  const out: string[] = [];
  if (input.companyName) out.push(input.companyName);
  const fromName = companyFromSenderName(input.fromName);
  if (fromName) out.push(fromName);
  if (!isAtsSender(input.fromAddress)) {
    // careers@acme-robotics.com → "acme robotics"
    const host = input.fromAddress.split("@")[1] ?? "";
    const parts = host.split(".");
    const root = parts.length >= 2 ? parts[parts.length - 2] : "";
    if (root && !GENERIC_DOMAINS.test(root)) out.push(root.replace(/-/g, " "));
  }
  return [...new Set(out)];
}

export type MatchedApplication = { id: string; companyName: string; jobTitle: string; statuses: ResumeStatus[] };

/**
 * The profile's most recent application whose company matches. Exact
 * normalized match first, then a prefix match either way ("acme" ~ "acme
 * robotics"), most recent first. Only ids and names come back.
 */
export async function matchApplication(profileId: string, candidates: string[]): Promise<MatchedApplication | null> {
  const keys = [...new Set(candidates.map((c) => companyKey(c)).filter((k): k is string => !!k && k.length >= 3))];
  if (keys.length === 0) return null;
  const select = { id: true, companyName: true, jobTitle: true, statuses: true } as const;

  const exact = await db.resume.findFirst({
    where: { profileId, companyKey: { in: keys } },
    orderBy: { createdAt: "desc" },
    select,
  });
  if (exact) return exact;

  for (const key of keys) {
    const loose = await db.resume.findFirst({
      where: {
        profileId,
        OR: [{ companyKey: { startsWith: `${key} ` } }, ...key.split(" ").length > 1 ? [{ companyKey: key.split(" ")[0] }] : []],
      },
      orderBy: { createdAt: "desc" },
      select,
    });
    if (loose) return loose;
  }
  return null;
}

const PIPELINE: ResumeStatus[] = ["APPLIED", "REPLY", "INTRO", "TECH1", "TECH2", "FINAL"];
const CLOSED: ResumeStatus[] = ["OFFER", "FAIL", "CANCELED"];

/**
 * The stage a confident email moves an application to, or null for no change.
 * A rejection closes it; an interview invite advances it one interview stage;
 * an assessment / AI interview means the company replied (at least Reply).
 */
export function nextStageFor(
  statuses: ResumeStatus[],
  category: "REJECTION" | "NEXT_STEP",
  nextStepKind: string | null
): ResumeStatus | null {
  if (statuses.some((s) => CLOSED.includes(s))) return null; // already closed — leave it for a person
  if (category === "REJECTION") return "FAIL";
  const current = getPrimaryStatus(statuses);
  const at = Math.max(0, PIPELINE.indexOf(current));
  if (nextStepKind === "interview") {
    const next = PIPELINE[Math.min(PIPELINE.length - 1, Math.max(at + 1, PIPELINE.indexOf("INTRO")))];
    return statuses.includes(next) ? null : next;
  }
  return at < PIPELINE.indexOf("REPLY") ? "REPLY" : null;
}
