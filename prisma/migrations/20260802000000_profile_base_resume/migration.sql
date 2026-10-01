-- The candidate's full base resume (see src/lib/base-resume). Raw text is
-- encrypted with the profile's DEK; imported-at gates resume generation.
ALTER TABLE "Profile" ADD COLUMN "baseResumeTextEnc" TEXT;
ALTER TABLE "Profile" ADD COLUMN "baseResumeFileName" TEXT;
ALTER TABLE "Profile" ADD COLUMN "baseResumeImportedAt" TIMESTAMP(3);
