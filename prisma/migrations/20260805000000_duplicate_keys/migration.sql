-- Duplicate-detection keys, checked before any AI call (src/lib/resumes/duplicates.ts).
ALTER TABLE "Resume" ADD COLUMN "companyKey" TEXT;
ALTER TABLE "Resume" ADD COLUMN "jobKey" TEXT;
ALTER TABLE "Resume" ADD COLUMN "jdFingerprint" TEXT;

CREATE INDEX "Resume_profileId_companyKey_idx" ON "Resume"("profileId", "companyKey");
CREATE INDEX "Resume_profileId_jobKey_idx" ON "Resume"("profileId", "jobKey");
CREATE INDEX "Resume_profileId_jdFingerprint_idx" ON "Resume"("profileId", "jdFingerprint");
