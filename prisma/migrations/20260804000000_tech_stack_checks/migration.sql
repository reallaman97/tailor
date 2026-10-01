-- Application Checks now judge only tech-stack relevance (see
-- src/lib/checks/application-checks.ts). The old country / work-style /
-- category criteria and verdict columns stay (deprecated) so no data is lost.
ALTER TABLE "AppSettings" ADD COLUMN "checkTechStack" TEXT NOT NULL DEFAULT '';
ALTER TABLE "TeamSettings" ADD COLUMN "checkTechStack" TEXT NOT NULL DEFAULT '';

ALTER TABLE "ApplicationCheck" ADD COLUMN "matchedTech" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ApplicationCheck" ADD COLUMN "primaryStack" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ApplicationCheck" ALTER COLUMN "countryOk" SET DEFAULT true;
ALTER TABLE "ApplicationCheck" ALTER COLUMN "remoteOk" SET DEFAULT true;
ALTER TABLE "ApplicationCheck" ALTER COLUMN "categoryOk" SET DEFAULT true;
