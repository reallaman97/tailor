-- New sign-ups require superadmin approval before they can log in.
-- Existing accounts are grandfathered in as already-approved so this
-- doesn't lock anyone out retroactively.

ALTER TABLE "User" ADD COLUMN "approved" BOOLEAN NOT NULL DEFAULT false;
UPDATE "User" SET "approved" = true;
