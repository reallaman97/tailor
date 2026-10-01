-- Cover letter + "Ask AI" application-question answers (see src/lib/assist).
ALTER TABLE "Resume" ADD COLUMN "coverLetterEnc" TEXT;
ALTER TABLE "Resume" ADD COLUMN "coverLetterGeneratedAt" TIMESTAMP(3);

CREATE TABLE "ApplicationAnswer" (
    "id" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "questionEnc" TEXT NOT NULL,
    "answerEnc" TEXT NOT NULL,
    "length" TEXT NOT NULL,
    "charLimit" INTEGER,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "reviewNote" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationAnswer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ApplicationAnswer_resumeId_createdAt_idx" ON "ApplicationAnswer"("resumeId", "createdAt");

ALTER TABLE "ApplicationAnswer" ADD CONSTRAINT "ApplicationAnswer_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;
