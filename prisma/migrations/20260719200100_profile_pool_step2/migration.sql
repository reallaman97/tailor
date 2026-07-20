-- Step 2 of 2: run after the backfill script (scripts/backfill-profile-dek.ts)
-- has populated encryptedDek for every existing Profile row.

ALTER TABLE "Profile" ALTER COLUMN "encryptedDek" SET NOT NULL;
