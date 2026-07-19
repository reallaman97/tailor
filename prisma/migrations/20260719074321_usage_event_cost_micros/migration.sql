-- Rename to preserve real precision: a single LLM call often costs a
-- fraction of a cent, which whole-cent storage would round down to zero.
ALTER TABLE "UsageEvent" RENAME COLUMN "estimatedCostCents" TO "estimatedCostMicros";
