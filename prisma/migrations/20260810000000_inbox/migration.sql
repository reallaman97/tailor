-- Inbox: each profile's Gmail, read for application updates (src/lib/inbox).
-- CreateEnum
CREATE TYPE "EmailCategory" AS ENUM ('APPLICATION_RECEIVED', 'REJECTION', 'NEXT_STEP', 'RECRUITER_OUTREACH', 'CONVERSATION', 'RESUME_REQUEST', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkMode" AS ENUM ('REMOTE', 'HYBRID', 'ONSITE', 'UNKNOWN');

-- CreateTable
CREATE TABLE "MailboxConnection" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "appPasswordEnc" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastError" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "uidValidity" TEXT,
    "lastUid" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailboxConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundEmail" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "references" TEXT,
    "fromAddress" TEXT NOT NULL,
    "fromName" TEXT,
    "replyTo" TEXT,
    "subject" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "bodyEnc" TEXT,
    "category" "EmailCategory" NOT NULL,
    "workMode" "WorkMode" NOT NULL DEFAULT 'UNKNOWN',
    "confidence" DOUBLE PRECISION NOT NULL,
    "classifiedBy" TEXT NOT NULL,
    "companyName" TEXT,
    "jobTitle" TEXT,
    "nextStepKind" TEXT,
    "summaryEnc" TEXT,
    "resumeId" TEXT,
    "appliedUpdate" TEXT,
    "needsAttention" BOOLEAN NOT NULL DEFAULT false,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'open',
    "suggestedReplyEnc" TEXT,
    "replySentAt" TIMESTAMP(3),
    "preparedResumeId" TEXT,
    "prepareStatus" TEXT,
    "prepareError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboundEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MailboxConnection_profileId_key" ON "MailboxConnection"("profileId");

-- CreateIndex
CREATE INDEX "InboundEmail_profileId_receivedAt_idx" ON "InboundEmail"("profileId", "receivedAt");

-- CreateIndex
CREATE INDEX "InboundEmail_profileId_needsAttention_status_idx" ON "InboundEmail"("profileId", "needsAttention", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InboundEmail_profileId_messageId_key" ON "InboundEmail"("profileId", "messageId");

-- AddForeignKey
ALTER TABLE "MailboxConnection" ADD CONSTRAINT "MailboxConnection_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundEmail" ADD CONSTRAINT "InboundEmail_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundEmail" ADD CONSTRAINT "InboundEmail_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundEmail" ADD CONSTRAINT "InboundEmail_preparedResumeId_fkey" FOREIGN KEY ("preparedResumeId") REFERENCES "Resume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

