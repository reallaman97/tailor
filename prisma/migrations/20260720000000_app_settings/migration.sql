-- CreateEnum
CREATE TYPE "ResumeTemplate" AS ENUM ('MODERN', 'CLASSIC');

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "openaiModel" TEXT NOT NULL DEFAULT 'gpt-4.1-mini',
    "tailoringPrompt" TEXT,
    "resumeTemplate" "ResumeTemplate" NOT NULL DEFAULT 'MODERN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- Seed the single settings row up front so app code can always assume it exists.
INSERT INTO "AppSettings" ("id", "updatedAt") VALUES ('singleton', CURRENT_TIMESTAMP);
