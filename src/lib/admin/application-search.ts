import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { getProfileNames } from "@/lib/profile/personal-info";
import { listAllApplications, type AdminTrackerRow } from "@/lib/admin/applications";

// Finding an application without knowing its exact company name or title.
// Searches every application (no date window). The query is split into words;
// an application matches when EVERY word appears somewhere in its company,
// title, posting link, bidder (username/email), or candidate name — in any
// order, case-insensitively, as part of a word ("acm robo" finds "ACME
// Robotics"). Company and title also match small typos ("amazn" → "Amazon")
// via pg_trgm. Only ids travel back from the database, then the matching rows
// — never every application.

const MAX_WORDS = 6;
const MAX_RESULTS = 50;
// How close a misspelt word must be to a word in the company or title (0–1).
const TYPO_SIMILARITY = 0.5;

function escapeLike(word: string): string {
  return word.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function searchWords(query: string): string[] {
  return [...new Set(query.toLowerCase().split(/[\s,]+/).map((w) => w.trim()).filter((w) => w.length >= 2))].slice(0, MAX_WORDS);
}

export async function searchApplications(query: string, opts: { teamId?: string } = {}): Promise<AdminTrackerRow[]> {
  const words = searchWords(query);
  if (words.length === 0) return [];

  // Candidate names are encrypted, so they're matched here, not in SQL. There
  // are only a handful of profiles.
  const profiles = await db.profile.findMany({
    where: opts.teamId ? { teamId: opts.teamId } : {},
    select: { id: true },
  });
  const names = await getProfileNames(profiles.map((p) => p.id));

  const ids = await findIds(words, names, opts.teamId, true).catch(() =>
    // pg_trgm not installed on this database — plain partial matching still works.
    findIds(words, names, opts.teamId, false)
  );
  if (ids.length === 0) return [];
  const rows = await listAllApplications({ ids, teamId: opts.teamId });
  const rank = new Map(ids.map((id, i) => [id, i]));
  return rows.sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
}

async function findIds(words: string[], names: Map<string, string>, teamId: string | undefined, fuzzy: boolean): Promise<string[]> {
  const conditions = words.map((word) => {
    const like = `%${escapeLike(word)}%`;
    const profileIds = [...names].filter(([, name]) => name.toLowerCase().includes(word)).map(([id]) => id);
    const parts = [
      Prisma.sql`r."companyName" ILIKE ${like}`,
      Prisma.sql`r."jobTitle" ILIKE ${like}`,
      Prisma.sql`coalesce(r."jobLink", '') ILIKE ${like}`,
      Prisma.sql`u."username" ILIKE ${like}`,
      Prisma.sql`u."email" ILIKE ${like}`,
      ...(profileIds.length ? [Prisma.sql`r."profileId" IN (${Prisma.join(profileIds)})`] : []),
      ...(fuzzy && word.length >= 4
        ? [
            Prisma.sql`word_similarity(${word}, r."companyName") >= ${TYPO_SIMILARITY}`,
            Prisma.sql`word_similarity(${word}, r."jobTitle") >= ${TYPO_SIMILARITY}`,
          ]
        : []),
    ];
    return Prisma.sql`(${Prisma.join(parts, " OR ")})`;
  });
  if (teamId) conditions.push(Prisma.sql`r."teamId" = ${teamId}`);

  const phrase = words.join(" ");
  // Best match first: closest company/title to the whole query, then newest.
  const order = fuzzy
    ? Prisma.sql`greatest(word_similarity(${phrase}, r."companyName"), word_similarity(${phrase}, r."jobTitle")) DESC, r."createdAt" DESC`
    : Prisma.sql`r."createdAt" DESC`;
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT r.id FROM "Resume" r JOIN "User" u ON u.id = r."userId"
    WHERE ${Prisma.join(conditions, " AND ")}
    ORDER BY ${order}
    LIMIT ${MAX_RESULTS}`;
  return rows.map((r) => r.id);
}
