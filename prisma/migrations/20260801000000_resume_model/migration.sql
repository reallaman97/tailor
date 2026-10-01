-- DeepSeek model used for resume generation (see src/lib/tailoring/models.ts).
-- Separate from openaiModel, which still drives the smaller OpenAI features.
ALTER TABLE "AppSettings" ADD COLUMN "resumeModel" TEXT NOT NULL DEFAULT 'deepseek-v4-pro';
ALTER TABLE "TeamSettings" ADD COLUMN "resumeModel" TEXT NOT NULL DEFAULT 'deepseek-v4-pro';
