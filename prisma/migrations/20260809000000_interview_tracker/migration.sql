-- Interview tracker notes (src/lib/interview-tracker).
CREATE TABLE IF NOT EXISTS "ApplicationNote" (
    "id" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "authorId" TEXT,
    "stage" "ResumeStatus",
    "body" TEXT NOT NULL DEFAULT '',
    "imageData" BYTEA,
    "imageMimeType" TEXT,
    "imageSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApplicationNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ApplicationNote_resumeId_createdAt_idx" ON "ApplicationNote"("resumeId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "ApplicationNote" ADD CONSTRAINT "ApplicationNote_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ApplicationNote" ADD CONSTRAINT "ApplicationNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Typo-tolerant application search (src/lib/admin/application-search.ts).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
