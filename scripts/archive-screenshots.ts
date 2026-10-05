/**
 * Re-encodes proof-of-application screenshots stored before archiving existed
 * (see src/lib/resumes/screenshot-archive.ts) — grayscale WebP, max 1280px
 * wide — to shrink the database. New uploads are archived as they arrive.
 *
 *   npx tsx --env-file=.env scripts/archive-screenshots.ts           # dry run: report savings only
 *   npx tsx --env-file=.env scripts/archive-screenshots.ts --apply   # rewrite the screenshots
 *
 * Lossy and one-way — run the dry run first. Idempotent: an already-archived
 * screenshot doesn't shrink meaningfully again, so it's skipped. A row whose
 * screenshot changes while this runs is left alone.
 */
import { db } from "@/lib/db";
import { archiveScreenshot } from "@/lib/resumes/screenshot-archive";

const APPLY = process.argv.includes("--apply");
// Only rewrite when it saves at least this much — re-archiving an archived image just churns.
const MIN_SAVING = 0.1;
const BATCH = 50;

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(0)} KB`;
}

async function main() {
  let cursor: string | undefined;
  let seen = 0;
  let rewritten = 0;
  let before = 0;
  let after = 0;

  for (;;) {
    // Ids first, then one image at a time — never hold a whole batch of images in memory.
    const ids = await db.resume.findMany({
      where: { screenshotData: { not: null } },
      select: { id: true },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (ids.length === 0) break;
    cursor = ids[ids.length - 1].id;

    for (const { id } of ids) {
      const row = await db.resume.findUnique({
        where: { id },
        select: { screenshotData: true, updatedAt: true },
      });
      if (!row?.screenshotData) continue;
      seen++;
      const original = Buffer.from(row.screenshotData);
      before += original.byteLength;

      const archived = await archiveScreenshot(original);
      if (!archived || archived.data.byteLength > original.byteLength * (1 - MIN_SAVING)) {
        after += original.byteLength;
        continue;
      }
      after += archived.data.byteLength;
      rewritten++;
      console.log(`${id}: ${kb(original.byteLength)} -> ${kb(archived.data.byteLength)}`);

      if (APPLY) {
        await db.resume.updateMany({
          // Unchanged since we read it — don't overwrite a screenshot uploaded meanwhile.
          where: { id, updatedAt: row.updatedAt },
          data: {
            screenshotData: new Uint8Array(archived.data),
            screenshotMimeType: archived.mimeType,
            // Keep updatedAt: it drives the follow-up reminders, and archiving isn't activity.
            updatedAt: row.updatedAt,
          },
        });
      }
    }
  }

  const saved = before - after;
  console.log(
    `\n${seen} screenshots, ${kb(before)} total. ${APPLY ? "Archived" : "Would archive"} ${rewritten}, ` +
      `saving ${kb(saved)}${before ? ` (${Math.round((saved / before) * 100)}%)` : ""}.`
  );
  if (!APPLY && rewritten > 0) console.log("Dry run — nothing changed. Re-run with --apply to rewrite them.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
