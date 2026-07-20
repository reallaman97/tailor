-- Several user accounts can share one candidate profile, so the tracker
-- needs to be scoped by profile (shared) rather than by the exact creating
-- user account. Add Resume.profileId, backfilled from each resume's
-- creating user's CURRENT profile assignment (best-effort — null if that
-- user currently has none).

ALTER TABLE "Resume" ADD COLUMN "profileId" TEXT;

UPDATE "Resume" r
SET "profileId" = u."profileId"
FROM "User" u
WHERE r."userId" = u."id" AND u."profileId" IS NOT NULL;

ALTER TABLE "Resume" ADD CONSTRAINT "Resume_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Resume_profileId_idx" ON "Resume"("profileId");
