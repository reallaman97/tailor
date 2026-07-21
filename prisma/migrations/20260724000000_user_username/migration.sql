-- AlterTable: add username, backfilling existing rows with a unique handle
-- derived from the email local-part (suffixing duplicates so the unique index
-- below can't fail), then enforce NOT NULL + uniqueness.
ALTER TABLE "User" ADD COLUMN "username" TEXT;

UPDATE "User" u
SET "username" = sub.uname
FROM (
  SELECT
    id,
    split_part(email, '@', 1) || CASE WHEN rn > 1 THEN '-' || rn::text ELSE '' END AS uname
  FROM (
    SELECT
      id,
      email,
      row_number() OVER (PARTITION BY split_part(email, '@', 1) ORDER BY "createdAt", id) AS rn
    FROM "User"
  ) ranked
) sub
WHERE u.id = sub.id;

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
