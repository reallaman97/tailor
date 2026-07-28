-- Interview Management module.
--
-- Adds the MANAGER role, a global interview timezone on AppSettings, three
-- config-driven lookup tables (stages / statuses / meeting types), and the
-- Interview record with its reference files and comments. The config tables are
-- seeded with sensible defaults so pickers are never empty and the app code
-- never has to upsert them.

-- AlterEnum
-- (Adding an enum value; the value is NOT used elsewhere in this migration, so
-- it is safe inside the migration's transaction on Postgres 12+.)
ALTER TYPE "UserRole" ADD VALUE 'MANAGER';

-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "interviewTimezone" TEXT NOT NULL DEFAULT 'UTC';

-- CreateTable
CREATE TABLE "InterviewStage" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewStatus" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewMeetingType" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewMeetingType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interview" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "callerId" TEXT,
    "applicationId" TEXT,
    "profileId" TEXT,
    "stageId" TEXT,
    "statusId" TEXT,
    "meetingTypeId" TEXT,
    "jobTitle" TEXT NOT NULL,
    "jobDescription" TEXT NOT NULL,
    "jobPostLink" TEXT,
    "companyName" TEXT NOT NULL,
    "salaryRange" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "meetingLink" TEXT,
    "interviewerInfo" TEXT,
    "resumeData" BYTEA,
    "resumeMimeType" TEXT,
    "resumeFilename" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewReferenceFile" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewReferenceFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewComment" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InterviewStage_active_sortOrder_idx" ON "InterviewStage"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "InterviewStatus_active_sortOrder_idx" ON "InterviewStatus"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "InterviewMeetingType_active_sortOrder_idx" ON "InterviewMeetingType"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "Interview_callerId_idx" ON "Interview"("callerId");

-- CreateIndex
CREATE INDEX "Interview_statusId_idx" ON "Interview"("statusId");

-- CreateIndex
CREATE INDEX "Interview_stageId_idx" ON "Interview"("stageId");

-- CreateIndex
CREATE INDEX "Interview_scheduledAt_idx" ON "Interview"("scheduledAt");

-- CreateIndex
CREATE INDEX "Interview_applicationId_idx" ON "Interview"("applicationId");

-- CreateIndex
CREATE INDEX "Interview_deletedAt_idx" ON "Interview"("deletedAt");

-- CreateIndex
CREATE INDEX "InterviewReferenceFile_interviewId_idx" ON "InterviewReferenceFile"("interviewId");

-- CreateIndex
CREATE INDEX "InterviewComment_interviewId_createdAt_idx" ON "InterviewComment"("interviewId", "createdAt");

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_callerId_fkey" FOREIGN KEY ("callerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Resume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "InterviewStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "InterviewStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_meetingTypeId_fkey" FOREIGN KEY ("meetingTypeId") REFERENCES "InterviewMeetingType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewReferenceFile" ADD CONSTRAINT "InterviewReferenceFile_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewReferenceFile" ADD CONSTRAINT "InterviewReferenceFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewComment" ADD CONSTRAINT "InterviewComment_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewComment" ADD CONSTRAINT "InterviewComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default config lists (stable, readable ids). Deactivating or renaming
-- these later never breaks historical interviews — the FK stays valid.
INSERT INTO "InterviewStage" ("id", "label", "sortOrder", "updatedAt") VALUES
    ('stage_introduce',   'Introduce',   0, CURRENT_TIMESTAMP),
    ('stage_technical',   'Technical',   1, CURRENT_TIMESTAMP),
    ('stage_coding_test', 'Coding Test', 2, CURRENT_TIMESTAMP),
    ('stage_culture',     'Culture',     3, CURRENT_TIMESTAMP),
    ('stage_final',       'Final',       4, CURRENT_TIMESTAMP);

INSERT INTO "InterviewStatus" ("id", "label", "color", "sortOrder", "updatedAt") VALUES
    ('status_scheduled', 'Scheduled', '#3b82f6', 0, CURRENT_TIMESTAMP),
    ('status_done',      'Done',      '#22c55e', 1, CURRENT_TIMESTAMP),
    ('status_rejected',  'Rejected',  '#ef4444', 2, CURRENT_TIMESTAMP),
    ('status_failed',    'Failed',    '#f59e0b', 3, CURRENT_TIMESTAMP);

INSERT INTO "InterviewMeetingType" ("id", "label", "sortOrder", "updatedAt") VALUES
    ('meeting_zoom',        'Zoom',        0, CURRENT_TIMESTAMP),
    ('meeting_google_meet', 'Google Meet', 1, CURRENT_TIMESTAMP),
    ('meeting_phone',       'Phone',       2, CURRENT_TIMESTAMP),
    ('meeting_onsite',      'Onsite',      3, CURRENT_TIMESTAMP);
