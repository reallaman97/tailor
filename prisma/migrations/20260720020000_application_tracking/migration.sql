-- New taxonomies for application tracking.
CREATE TYPE "RoleTrack" AS ENUM ('BACKEND', 'FRONTEND', 'FULL_STACK', 'DEVOPS_CLOUD', 'DATA', 'AI_ML', 'SUPPORT_OPS', 'MOBILE', 'OTHER');
CREATE TYPE "ApplicationSource" AS ENUM ('JOB_BOARD', 'LINKEDIN_OUTREACH', 'RECRUITER', 'OTHER');
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Rework ResumeStatus into a full post-submission pipeline. Existing values
-- are mapped onto the closest new stage (dev data only — see mapping below).
ALTER TYPE "ResumeStatus" RENAME TO "ResumeStatus_old";
CREATE TYPE "ResumeStatus" AS ENUM ('DRAFT', 'APPLIED', 'REPLY', 'INTRO', 'TECH1', 'TECH2', 'FINAL', 'OFFER', 'FAIL', 'CANCELED', 'GHOSTED');

ALTER TABLE "Resume" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Resume" ALTER COLUMN "status" TYPE "ResumeStatus" USING (
  CASE "status"::text
    WHEN 'DRAFT' THEN 'DRAFT'
    WHEN 'GENERATED' THEN 'DRAFT'
    WHEN 'APPLIED' THEN 'APPLIED'
    WHEN 'INTERVIEWING' THEN 'INTRO'
    WHEN 'OFFER' THEN 'OFFER'
    WHEN 'REJECTED' THEN 'CANCELED'
    WHEN 'ARCHIVED' THEN 'CANCELED'
    ELSE 'DRAFT'
  END
)::"ResumeStatus";
ALTER TABLE "Resume" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

DROP TYPE "ResumeStatus_old";

-- New tracking fields.
ALTER TABLE "Resume" ADD COLUMN "roleTrack" "RoleTrack" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "Resume" ADD COLUMN "source" "ApplicationSource" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "Resume" ADD COLUMN "followUpDate" TIMESTAMP(3);
ALTER TABLE "Resume" ADD COLUMN "notes" TEXT;
ALTER TABLE "Resume" ADD COLUMN "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Resume" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "Resume" ADD COLUMN "screenshotData" BYTEA;
ALTER TABLE "Resume" ADD COLUMN "screenshotMimeType" TEXT;

CREATE INDEX "Resume_userId_roleTrack_idx" ON "Resume"("userId", "roleTrack");
CREATE INDEX "Resume_userId_source_idx" ON "Resume"("userId", "source");
CREATE INDEX "Resume_approvalStatus_idx" ON "Resume"("approvalStatus");
