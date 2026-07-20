-- Flips Profile<->User from 1:1 (Profile.userId, unique) to many-to-one
-- (User.profileId, not unique) so a superadmin can assign the same pool
-- profile to more than one account.

ALTER TABLE "User" ADD COLUMN "profileId" TEXT;

-- Carry over the existing assignments before dropping the old column.
UPDATE "User" u
SET "profileId" = p."id"
FROM "Profile" p
WHERE p."userId" = u."id";

ALTER TABLE "User" ADD CONSTRAINT "User_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "User_profileId_idx" ON "User"("profileId");

ALTER TABLE "Profile" DROP CONSTRAINT "Profile_userId_fkey";
DROP INDEX "Profile_userId_key";
ALTER TABLE "Profile" DROP COLUMN "userId";
