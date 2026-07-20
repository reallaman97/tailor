-- Step 1 of 2: decouple Profile from User so profiles can exist unassigned
-- in an admin-managed pool. encryptedDek starts nullable — a backfill
-- script populates it (and re-encrypts existing rows under their own key)
-- before step 2 makes it NOT NULL.

ALTER TABLE "Profile" ADD COLUMN "encryptedDek" TEXT;

ALTER TABLE "Profile" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "Profile" DROP CONSTRAINT "Profile_userId_fkey";
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
