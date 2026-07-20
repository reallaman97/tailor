-- An application can hold several simultaneous pipeline stages at once
-- (e.g. Applied+Reply+Tech1); replace the single `status` enum column with
-- a `statuses` array, migrating each existing row's one value into a
-- single-element array.

ALTER TABLE "Resume" ADD COLUMN "statuses" "ResumeStatus"[] NOT NULL DEFAULT ARRAY['DRAFT']::"ResumeStatus"[];

UPDATE "Resume" SET "statuses" = ARRAY["status"];

DROP INDEX IF EXISTS "Resume_userId_status_idx";

ALTER TABLE "Resume" DROP COLUMN "status";

CREATE INDEX "Resume_userId_idx" ON "Resume"("userId");
