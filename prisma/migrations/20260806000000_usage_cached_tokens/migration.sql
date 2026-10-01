-- Prompt-cache hits per AI call, so cost estimates price them correctly (src/lib/tailoring/usage.ts).
ALTER TABLE "UsageEvent" ADD COLUMN "cachedInputTokens" INTEGER NOT NULL DEFAULT 0;
