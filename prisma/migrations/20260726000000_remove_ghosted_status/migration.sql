-- Ghosting is removed entirely. Drop GHOSTED from any stored status arrays
-- first (defensive — no GHOSTED data is expected), then recreate the enum
-- without that value.
UPDATE "Resume"
SET "statuses" = array_remove("statuses", 'GHOSTED'::"ResumeStatus")
WHERE 'GHOSTED' = ANY ("statuses");

-- Any row left with no statuses falls back to APPLIED.
UPDATE "Resume"
SET "statuses" = ARRAY['APPLIED']::"ResumeStatus"[]
WHERE cardinality("statuses") = 0;

ALTER TABLE "Resume" ALTER COLUMN "statuses" DROP DEFAULT;

ALTER TYPE "ResumeStatus" RENAME TO "ResumeStatus_old";
CREATE TYPE "ResumeStatus" AS ENUM ('DRAFT', 'APPLIED', 'REPLY', 'INTRO', 'TECH1', 'TECH2', 'FINAL', 'OFFER', 'FAIL', 'CANCELED');

ALTER TABLE "Resume"
  ALTER COLUMN "statuses" TYPE "ResumeStatus"[] USING "statuses"::text[]::"ResumeStatus"[];

ALTER TABLE "Resume" ALTER COLUMN "statuses" SET DEFAULT ARRAY['DRAFT']::"ResumeStatus"[];

DROP TYPE "ResumeStatus_old";
